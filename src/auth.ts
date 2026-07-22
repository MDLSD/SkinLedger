import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { checkLimit, clearLimit, recordFailure } from "@/lib/rate-limit";
import { clientIpFromHeaders } from "@/lib/client-ip";
import { loginSchema } from "@/lib/validation";
import { DUMMY_HASH, hashPassword, needsRehash } from "@/lib/password";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email?: string | null;
    };
  }
}

// Аугментируем @auth/core/jwt: next-auth/jwt его только реэкспортирует,
// поэтому расширять надо исходный модуль.
declare module "@auth/core/jwt" {
  interface JWT {
    id?: string;
    /** Момент входа, мс. Своя метка вместо iat — тот переустанавливается. */
    authAt?: number;
  }
}

// Лимиты попыток входа. Считаем только неудачи, в двух осях:
// по email (защита аккаунта от перебора с любых IP) и по IP (защита от
// спрея паролей по многим аккаунтам с одного адреса).
const EMAIL_LIMIT = 10;
const EMAIL_WINDOW_MS = 15 * 60_000;
const IP_LIMIT = 30;
const IP_WINDOW_MS = 60_000;

/** Превышен лимит попыток; retryAfterSec зашит в code для UI-формы. */
export class RateLimitedError extends CredentialsSignin {
  constructor(retryAfterSec: number) {
    super("rate_limited");
    this.code = `rate_limited:${retryAfterSec}`;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  // Флаг Secure не должен зависеть от заголовка прокси: без x-forwarded-proto
  // от nginx приложение выдавало cookie сессии без Secure и без префикса
  // __Host- на csrf-токене.
  useSecureCookies: process.env.NODE_ENV === "production",
  // 30 дней по умолчанию — слишком долго; отзыв есть, но им ещё надо
  // воспользоваться, а неделя ограничивает окно для угнанного токена сама.
  session: { strategy: "jwt", maxAge: 7 * 24 * 60 * 60 },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        email: {},
        password: {},
      },
      async authorize(credentials, request) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const email = parsed.data.email.toLowerCase();
        const ip = clientIpFromHeaders(request?.headers);
        const emailKey = `login:email:${email}`;
        const ipKey = `login:ip:${ip}`;

        // IP-ось — жёсткая: проверяется ДО БД и bcrypt. Это единственная
        // точка, через которую проходят все пути входа (включая прямые
        // POST на /api/auth/callback/credentials), и она защищает CPU от
        // объёмного перебора с одного адреса.
        const byIp = checkLimit(ipKey, IP_LIMIT);
        if (byIp.limited) throw new RateLimitedError(byIp.retryAfterSec);

        // Email-ось НЕ запирает верный пароль: иначе атакующий, зная лишь
        // email жертвы, залочил бы ей вход (lockout-DoS). Поэтому пароль
        // проверяем всегда, а лимит применяем только к неверным попыткам.
        const byEmail = checkLimit(emailKey, EMAIL_LIMIT);

        const user = await prisma.user.findUnique({ where: { email } });
        // Сравниваем всегда — в том числе с фиктивным хешем, если юзера нет.
        const valid = await bcrypt.compare(
          parsed.data.password,
          user?.passwordHash ?? DUMMY_HASH,
        );

        if (!user || !valid) {
          recordFailure(emailKey, EMAIL_WINDOW_MS);
          recordFailure(ipKey, IP_WINDOW_MS);
          if (byEmail.limited) throw new RateLimitedError(byEmail.retryAfterSec);
          return null;
        }

        clearLimit(emailKey);

        // Пароль верный и он у нас в руках — единственный момент, когда
        // старый хеш можно поднять до текущей стоимости.
        if (needsRehash(user.passwordHash)) {
          await prisma.user.update({
            where: { id: user.id },
            data: { passwordHash: await hashPassword(parsed.data.password) },
          });
        }

        return { id: user.id, email: user.email };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        // Собственная метка времени входа. Полагаться на `iat` нельзя:
        // @auth/core переподписывает токен при каждом чтении сессии
        // (jwt.js:57 setIssuedAt), поэтому iat постоянно обновляется.
        token.authAt = Date.now();
      }
      if (!token.id) return null;

      // Отзыв сессий без серверного хранилища: токен, выданный до рубежа
      // sessionsValidFrom, признаётся недействительным. Возврат null здесь
      // заставляет @auth/core стереть cookie сессии.
      const owner = await prisma.user.findUnique({
        where: { id: token.id as string },
        select: { sessionsValidFrom: true },
      });
      if (!owner) return null;
      const authAt = typeof token.authAt === "number" ? token.authAt : 0;
      if (authAt < owner.sessionsValidFrom.getTime()) return null;

      return token;
    },
    session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
});
