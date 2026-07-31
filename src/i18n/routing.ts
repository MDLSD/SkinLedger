import { defineRouting } from "next-intl/routing";

/**
 * Русский — язык по умолчанию и живёт БЕЗ префикса (`/app`), английский —
 * с префиксом (`/en/app`). Это режим `as-needed`: адреса, которые уже
 * разошлись по ссылкам, остаются прежними.
 *
 * `localeDetection` включён (дефолт next-intl): для пути без префикса локаль
 * берётся из cookie NEXT_LOCALE, а при её отсутствии — из Accept-Language,
 * и при несовпадении с русским выдаётся редирект на `/en/...`.
 */
export const routing = defineRouting({
  locales: ["ru", "en"],
  defaultLocale: "ru",
  localePrefix: "as-needed",
});

export type Locale = (typeof routing.locales)[number];

/**
 * Сегмент `[locale]` Next типизирует как обычную строку, а API next-intl
 * требуют объявленную локаль. Сюда чужое значение не доходит: корневой layout
 * отдаёт на нём 404 — но типы об этом не знают, поэтому сводим явно.
 * Проверка списком, а не `hasLocale`, чтобы не тянуть next-intl в proxy.
 */
export function toLocale(value: string): Locale {
  return (routing.locales as readonly string[]).includes(value)
    ? (value as Locale)
    : routing.defaultLocale;
}

/** Префикс локали для ручной сборки адреса (в proxy, где нет хелперов next-intl). */
export function localePrefix(locale: string): string {
  return locale === routing.defaultLocale ? "" : `/${locale}`;
}

/**
 * Путь без префикса локали. Нужен там, где правило должно быть одно на обе
 * локали — иначе `/en/app` не совпал бы ни с одним из них.
 */
export function stripLocale(pathname: string): { locale: string; path: string } {
  for (const locale of routing.locales) {
    if (locale === routing.defaultLocale) continue;
    if (pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)) {
      return { locale, path: pathname.slice(locale.length + 1) || "/" };
    }
  }
  return { locale: routing.defaultLocale, path: pathname };
}
