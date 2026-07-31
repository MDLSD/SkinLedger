import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";

// ТЗ 7.4: приватная зона закрыта от индексации, публичная — открыта.
// Появилась вместе с первой публичной страницей (/skins/[slug]).
const SITE = process.env.AUTH_URL ?? "http://localhost:3000";

const PRIVATE = ["/app/", "/api/", "/login", "/register"];

export default function robots(): MetadataRoute.Robots {
  // Каждый приватный путь существует ещё и под префиксом локали: без /en/app/
  // в списке англоязычная копия приватной зоны осталась бы открытой.
  const disallow = routing.locales.flatMap((locale) =>
    locale === routing.defaultLocale
      ? PRIVATE
      : PRIVATE.map((p) => `/${locale}${p}`),
  );

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow,
    },
    host: SITE,
  };
}
