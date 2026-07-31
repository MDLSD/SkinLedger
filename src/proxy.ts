import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { localePrefix, routing, stripLocale } from "@/i18n/routing";

/**
 * Заградительный слой перед рендером. Делает три вещи.
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
 * 2. Разводит запрос по локали (next-intl): `/app` — русский, `/en/app` —
 *    английский.
 *
 * 3. Выдаёт CSP с одноразовым nonce вместо 'unsafe-inline' в script-src.
 *    Заголовок должен ставиться на запрос, поэтому он живёт здесь,
 *    а не в next.config.ts.
 *
 * Порядок важен: сессия проверяется ПЕРВОЙ и по пути без префикса локали,
 * иначе `/en/app` не совпал бы ни с одним правилом и приватная зона
 * открылась бы без cookie.
 */

// Префикс __Secure- появляется при useSecureCookies, а суффикс .0/.1 —
// когда токен не влезает в одну cookie и @auth/core режет его на чанки
// (SessionStore в @auth/core/lib/utils/cookie.js). Точное имя проверять нельзя:
// пользователь с длинным токеном оказался бы «неавторизованным».
const SESSION_COOKIE = /^(__Secure-)?authjs\.session-token(\.\d+)?$/;

// Пути, требующие сессии. `/api/auth/*` сюда не входит: через него как раз
// и происходит вход, когда cookie ещё нет. Сравниваются с путём БЕЗ префикса
// локали, поэтому одно правило закрывает и `/app`, и `/en/app`.
const PROTECTED = ["/app", "/api/deals", "/api/skins"];

const handleI18nRouting = createMiddleware(routing);

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

/**
 * Прокидывает изменённые заголовки ЗАПРОСА в рендер.
 *
 * Обычно это делает `NextResponse.next({ request: { headers } })`, но ответ
 * здесь создаёт next-intl (для дефолтной локали — рерайт в `/ru/...`), поэтому
 * служебные заголовки приходится дописывать к готовому ответу вручную.
 * Протокол — `x-middleware-request-<name>` плюс перечисление имён
 * в `x-middleware-override-headers` (см. NextResponse.next в next/dist/server/
 * web/spec-extension/response.js).
 *
 * Список в override — БЕЛЫЙ: заголовки запроса, которых в нём нет, Next удаляет
 * (resolve-routes.js). Поэтому когда next-intl список не выставил, переносим
 * заголовки запроса целиком сами.
 */
function applyRequestHeaders(
  response: NextResponse,
  request: NextRequest,
  extra: Record<string, string>,
): void {
  // У редиректа рендера не будет — заголовки запроса ему некуда передавать.
  if (response.headers.has("location")) return;

  const existing = response.headers.get("x-middleware-override-headers");
  const keys = new Set(
    existing ? existing.split(",").map((k) => k.trim()) : [],
  );

  if (!existing) {
    for (const [key, value] of request.headers) {
      response.headers.set(`x-middleware-request-${key}`, value);
      keys.add(key);
    }
  }

  for (const [key, value] of Object.entries(extra)) {
    response.headers.set(`x-middleware-request-${key}`, value);
    keys.add(key);
  }

  response.headers.set("x-middleware-override-headers", [...keys].join(","));
}

/** Префетч next/link: нужен рерайт локали, но не нужен nonce. */
function isPrefetch(request: NextRequest): boolean {
  return (
    request.headers.has("next-router-prefetch") ||
    request.headers.get("purpose") === "prefetch"
  );
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const { locale, path } = stripLocale(pathname);

  if (PROTECTED.some((p) => path === p || path.startsWith(`${p}/`))) {
    const hasSession = request.cookies
      .getAll()
      .some((c) => SESSION_COOKIE.test(c.name));
    if (!hasSession) {
      if (path.startsWith("/api/")) {
        return new NextResponse("Unauthorized", { status: 401 });
      }
      return NextResponse.redirect(
        new URL(`${localePrefix(locale)}/login`, request.url),
      );
    }
  }

  // Route handlers, служебные пути и файлы локализации не подлежат: next-intl
  // приписал бы им префикс и увёл запрос в несуществующий маршрут.
  const skipI18n =
    path.startsWith("/api/") ||
    pathname.startsWith("/_next") ||
    pathname.includes(".");

  const response = skipI18n
    ? NextResponse.next()
    : handleI18nRouting(request);

  // Префетчи проходят через рерайт локали (без него страницы под [locale]
  // отдали бы 404), но nonce им не выдаём: он одноразовый и только мешал бы кэшу.
  if (isPrefetch(request)) return response;

  const nonce = crypto.randomUUID().replace(/-/g, "");
  const csp = buildCsp(nonce, process.env.NODE_ENV === "development");

  // Next вычитывает nonce из CSP входящего запроса и сам проставляет его
  // своим скриптам, поэтому заголовок нужен и на запросе, и на ответе.
  applyRequestHeaders(response, request, {
    "x-nonce": nonce,
    "content-security-policy": csp,
  });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    // Всё, кроме статики и оптимизированных картинок. Префетчи исключать
    // из матчера нельзя: рерайт локали нужен и им.
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
