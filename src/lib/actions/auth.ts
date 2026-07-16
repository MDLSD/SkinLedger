"use server";

import bcrypt from "bcryptjs";
import { AuthError, CredentialsSignin } from "next-auth";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { signIn, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { loginSchema, registerSchema } from "@/lib/validation";

export type AuthFormState = { error?: string };

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

  const email = parsed.data.email.toLowerCase();
  const { password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "Пользователь с таким email уже зарегистрирован" };
  }

  const passwordHash = await bcrypt.hash(password, 10);
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
