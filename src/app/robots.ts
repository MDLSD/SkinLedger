import type { MetadataRoute } from "next";

// ТЗ 7.4: приватная зона закрыта от индексации, публичная — открыта.
// Появилась вместе с первой публичной страницей (/skins/[slug]).
const SITE = process.env.AUTH_URL ?? "http://localhost:3000";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/app/", "/api/", "/login", "/register"],
    },
    host: SITE,
  };
}
