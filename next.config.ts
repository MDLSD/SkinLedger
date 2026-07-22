import type { NextConfig } from "next";

// CSP выдаётся не отсюда, а из src/proxy.ts: nonce должен быть свой на каждый
// запрос, а статический заголовок этого не умеет. Здесь — только заголовки,
// одинаковые для всех ответов. Два заголовка CSP браузер применяет
// пересечением, поэтому дублировать его тут нельзя.
const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
];

const nextConfig: NextConfig = {
  // xlsx — тяжёлый CJS-пакет, читается только в серверном экшене импорта.
  serverExternalPackages: ["xlsx"],
  experimental: {
    serverActions: {
      // Импорт проверяет размер файла на 5 МБ, но дефолтный лимит тела
      // server action — 1 МБ, и файлы крупнее отваливались раньше с невнятной
      // ошибкой платформы. Запас сверх 5 МБ — на multipart-обвязку
      // (границы, заголовки частей), как советует документация.
      bodySizeLimit: "6mb",
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
