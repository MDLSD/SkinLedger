"use server";

import bcrypt from "bcryptjs";
import { AuthError, CredentialsSignin } from "next-auth";
import { headers } from "next/headers";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { auth, signIn, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { checkLimit, recordFailure } from "@/lib/rate-limit";
import { clientIpFromHeaders } from "@/lib/client-ip";
import { changePasswordSchema, loginSchema, registerSchema } from "@/lib/validation";
import { hashPassword } from "@/lib/password";

export type AuthFormState = { error?: string };

// Лимит регистраций: ключ только по IP, чтобы смена email не обходила его.
// bcrypt.hash дорог — это ещё и защита CPU от массовой регистрации.
const REGISTER_LIMIT = 5;
const REGISTER_WINDOW_MS = 60 * 60_000;

async function clientIp(): Promise<string> {
  return clientIpFromHeaders(await headers());
}

// Ошибка из authorize() может прийти как есть или обёрнутой (cause.err).
function rateLimitRetrySec(e: unknown): number | null {
  const codes: unknown[] = [];
  if (e instanceof CredentialsSignin) codes.push(e.code);
  if (e instanceof AuthError && e.cause?.err instanceof CredentialsSignin) {
    codes.push(e.cause.err.code);
  }
  for (const code of codes) {
    if (typeof code === "string" && code.startsWith("rate_limited")) {
      const sec = parseInt(code.split(":")[1] ?? "", 10);
      return Number.isFinite(sec) && sec > 0 ? sec : 60;
    }
  }
  return null;
}

export async function registerAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = registerSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const ipKey = `register:ip:${await clientIp()}`;
  const limit = checkLimit(ipKey, REGISTER_LIMIT);
  if (limit.limited) {
    return {
      error: `Слишком много регистраций. Повторите через ${Math.ceil(limit.retryAfterSec / 60)} мин.`,
    };
  }
  // Считаем каждую попытку (не только успешные): массовую регистрацию
  // с одного адреса нужно резать независимо от исхода.
  recordFailure(ipKey, REGISTER_WINDOW_MS);

  const email = parsed.data.email.toLowerCase();
  const { password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "Пользователь с таким email уже зарегистрирован" };
  }

  const passwordHash = await hashPassword(password);
  await prisma.user.create({ data: { email, passwordHash } });

  try {
    await signIn("credentials", { email, password, redirectTo: "/app" });
  } catch (e) {
    if (isRedirectError(e)) throw e;
    return { error: "Аккаунт создан, но войти не удалось. Попробуйте войти вручную." };
  }
  return {};
}

export async function loginAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email.toLowerCase(),
      password: parsed.data.password,
      redirectTo: "/app",
    });
  } catch (e) {
    if (isRedirectError(e)) throw e;
    const retrySec = rateLimitRetrySec(e);
    if (retrySec != null) {
      return {
        error: `Слишком много попыток входа. Повторите через ${retrySec} с.`,
      };
    }
    if (e instanceof AuthError) {
      return { error: "Неверный email или пароль" };
    }
    throw e;
  }
  return {};
}

export async function logoutAction() {
  await signOut({ redirectTo: "/login" });
}

// Лимит на подбор пароля при удалении аккаунта (действие необратимое).
const DELETE_LIMIT = 10;
const DELETE_WINDOW_MS = 15 * 60_000;

export async function deleteAccountAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Не авторизован" };
  const userId = session.user.id;

  const password = formData.get("password")?.toString() ?? "";
  if (!password) return { error: "Введите пароль для подтверждения" };

  const key = `delacct:user:${userId}`;
  if (checkLimit(key, DELETE_LIMIT).limited) {
    return { error: "Слишком много попыток. Повторите позже." };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  });
  if (!user) return { error: "Не авторизован" };

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    recordFailure(key, DELETE_WINDOW_MS);
    return { error: "Пароль неверен" };
  }

  // Удаляем все данные пользователя явной транзакцией: сделки → свои
  // площадки → аккаунт (порядок исключает конфликт FK сделка→площадка).
  await prisma.$transaction([
    prisma.deal.deleteMany({ where: { userId } }),
    prisma.platform.deleteMany({ where: { userId, isCustom: true } }),
    prisma.user.delete({ where: { id: userId } }),
  ]);

  // Пробрасывает redirect — очищает cookie и уводит на лендинг.
  await signOut({ redirectTo: "/?deleted=1" });
  return {};
}

// Лимит на подбор ТЕКУЩЕГО пароля через форму смены: сессия у атакующего
// уже есть, но пароль мог бы утечь для переиспользования на других сайтах.
const CHANGE_PW_LIMIT = 10;
const CHANGE_PW_WINDOW_MS = 15 * 60_000;

export async function changePasswordAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Не авторизован" };
  const userId = session.user.id;

  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const key = `changepw:user:${userId}`;
  const limit = checkLimit(key, CHANGE_PW_LIMIT);
  if (limit.limited) {
    return { error: `Слишком много попыток. Повторите через ${limit.retryAfterSec} с.` };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  });
  if (!user) return { error: "Не авторизован" };

  const valid = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
  if (!valid) {
    recordFailure(key, CHANGE_PW_WINDOW_MS);
    return { error: "Текущий пароль неверен" };
  }

  // Смена пароля двигает рубеж действительности сессий: все выданные
  // токены, включая текущий, перестают действовать. Это и есть ответ
  // на компрометацию аккаунта — «выйти на всех устройствах».
  await prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash: await hashPassword(parsed.data.newPassword),
      sessionsValidFrom: new Date(),
    },
  });

  await signOut({ redirectTo: "/login?changed=1" });
  return {};
}
