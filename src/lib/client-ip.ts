// Клиентский IP для rate-limit. Заголовок x-forwarded-for подделываем, если
// перед приложением нет доверенного прокси. Доверяем ему только при
// TRUST_PROXY=true (Vercel/nginx, которые перезаписывают заголовок реальным IP,
// а не добавляют клиентский). Иначе — единый ключ "unknown" (fail-closed:
// ротацией поддельных IP лимит не обойти).
// В проде без TRUST_PROXY=true все клиенты делят ключ "unknown": подделку IP
// это не пропускает, но один атакующий блокирует вход и регистрацию всем.
// Падаем, а не деградируем молча (DEPLOY.md это уже требует).
// Проверка именно в момент вызова, а не на уровне модуля: `next build`
// собирает данные страниц с NODE_ENV=production, и бросок на импорте
// уронил бы сборку, где никакого TRUST_PROXY быть и не должно.
function assertTrustProxyConfigured(): void {
  if (process.env.NODE_ENV === "production" && process.env.TRUST_PROXY !== "true") {
    throw new Error(
      "TRUST_PROXY=true обязателен в проде: без него rate-limit работает единым " +
        "ключом и один клиент блокирует вход всем. См. DEPLOY.md.",
    );
  }
}

export function clientIpFromHeaders(h: Headers | null | undefined): string {
  assertTrustProxyConfigured();
  if (process.env.TRUST_PROXY === "true" && h) {
    const xff = h.get("x-forwarded-for");
    const first = xff?.split(",")[0]?.trim();
    if (first) return first;
    const real = h.get("x-real-ip")?.trim();
    if (real) return real;
  }
  return "unknown";
}
