import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Заградительный слой перед рендером. Делает две вещи.
 *
 * 1. Отсекает запросы без cookie сессии. Раньше защита держалась только
 *    на явном `auth()` в каждой точке входа: `app/layout.tsx` закрывает
 *    страницы под `/app`, но layout не покрывает route handlers, поэтому
 *    каждый новый файл под `src/app/api/` был публичен по умолчанию.
 *    Это именно заграждение, а не проверка подлинности: подпись токена
 *    и его отзыв проверяет `auth()` в самом обработчике. Cookie здесь
 *    намеренно не расшифровывается — документация просит не тащить
 *    в proxy общий код приложения, а отзыв всё равно требует БД.
 *
 * 2. Выдаёт CSP с одноразовым nonce вместо 'unsafe-inline' в script-src.
 *    Заголовок должен ставиться на запрос, поэтому он живёт здесь,
 *    а не в next.config.ts.
 */

// Префикс __Secure- появляется при useSecureCookies, а суффикс .0/.1 —
// когда токен не влезает в одну cookie и @auth/core режет его на чанки
// (SessionStore в @auth/core/lib/utils/cookie.js). Точное имя проверять нельзя:
// пользователь с длинным токеном оказался бы «неавторизованным».
const SESSION_COOKIE = /^(__Secure-)?authjs\.session-token(\.\d+)?$/;

// Пути, требующие сессии. `/api/auth/*` сюда не входит: через него как раз
// и происходит вход, когда cookie ещё нет.
const PROTECTED = ["/app", "/api/deals", "/api/skins"];

function buildCsp(nonce: string, isDev: boolean): string {
  return [
    "default-src 'self'",
    // 'strict-dynamic' переносит доверие с origin на nonce: скрипты, которые
    // Next подгружает сам, наследуют разрешение от помеченного nonce.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    // Стили остаются с 'unsafe-inline': nonce не распространяется на атрибут
    // style, а React и Base UI выставляют inline-стили на элементах.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https://*.steamstatic.com",
    "font-src 'self' data:",
    `connect-src 'self'${isDev ? " ws:" : ""}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; ");
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PROTECTED.some((p) => pathname.startsWith(p))) {
    const hasSession = request.cookies
      .getAll()
      .some((c) => SESSION_COOKIE.test(c.name));
    if (!hasSession) {
      if (pathname.startsWith("/api/")) {
        return new NextResponse("Unauthorized", { status: 401 });
      }
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  const nonce = crypto.randomUUID().replace(/-/g, "");
  const csp = buildCsp(nonce, process.env.NODE_ENV === "development");

  // Next вычитывает nonce из CSP входящего запроса и сам проставляет его
  // своим скриптам, поэтому заголовок нужен и на запросе, и на ответе.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      // Всё, кроме статики и оптимизированных картинок; префетчи next/link
      // пропускаем — CSP им не нужен, а nonce на них только мешал бы кэшу.
      source: "/((?!_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
