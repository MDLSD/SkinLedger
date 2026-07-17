// Клиентский IP для rate-limit. Заголовок x-forwarded-for подделываем, если
// перед приложением нет доверенного прокси. Доверяем ему только при
// TRUST_PROXY=true (Vercel/nginx, которые перезаписывают заголовок реальным IP,
// а не добавляют клиентский). Иначе — единый ключ "unknown" (fail-closed:
// ротацией поддельных IP лимит не обойти).
export function clientIpFromHeaders(h: Headers | null | undefined): string {
  if (process.env.TRUST_PROXY === "true" && h) {
    const xff = h.get("x-forwarded-for");
    const first = xff?.split(",")[0]?.trim();
    if (first) return first;
    const real = h.get("x-real-ip")?.trim();
    if (real) return real;
  }
  return "unknown";
}
