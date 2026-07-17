import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { checkLimit, clearLimit, recordFailure } from "@/lib/rate-limit";
import { clientIpFromHeaders } from "@/lib/client-ip";
import { loginSchema } from "@/lib/validation";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email?: string | null;
    };
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
  session: { strategy: "jwt" },
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
        const valid = user
          ? await bcrypt.compare(parsed.data.password, user.passwordHash)
          : false;

        if (!user || !valid) {
          recordFailure(emailKey, EMAIL_WINDOW_MS);
          recordFailure(ipKey, IP_WINDOW_MS);
          if (byEmail.limited) throw new RateLimitedError(byEmail.retryAfterSec);
          return null;
        }

        clearLimit(emailKey);
        return { id: user.id, email: user.email };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) token.id = user.id;
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
