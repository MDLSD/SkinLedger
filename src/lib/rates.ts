import "server-only";
import { FALLBACK_RATES, type Rates } from "@/lib/currency";
import { CURRENCIES } from "@/lib/validation";

// Парсер курсов валют: тянем с open.er-api.com (бесплатно, без ключа, есть RUB),
// кэшируем в памяти процесса на 6 часов. При недоступности — запасные курсы.
// Список обязательных валют выведен из CURRENCIES: добавление валюты в приложение
// автоматически делает её обязательной здесь, иначе таблица курсов «поедет» молча.
const SUPPORTED: readonly string[] = CURRENCIES;
const TTL_MS = 6 * 3600_000;
const URL = "https://open.er-api.com/v6/latest/USD";

let cache: { at: number; rates: Rates } | null = null;

// live — свежий ответ парсера; cache — прошлый ответ, обновить не удалось;
// fallback — захардкоженные запасные курсы. Раньше «протухший кэш» и «частичный
// ответ» оба отдавались как live, и предупредить пользователя было нечем.
export type RatesSource = "live" | "cache" | "fallback";
export type RatesResult = { rates: Rates; updatedAt: number; source: RatesSource };

// Ответ годен, только если пришли ВСЕ поддерживаемые валюты. Частичный ответ
// раньше кэшировался как живой, и fxFactor по недостающей валюте молча давал 1:1.
function toCompleteRates(raw: Record<string, number> | undefined): Rates | null {
  if (!raw) return null;
  const rates: Rates = { USD: 1 };
  for (const c of SUPPORTED) {
    const v = c === "USD" ? 1 : raw[c];
    if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) return null;
    rates[c] = v;
  }
  return rates;
}

export async function getRates(): Promise<RatesResult> {
  if (cache && Date.now() - cache.at < TTL_MS) {
    return { rates: cache.rates, updatedAt: cache.at, source: "live" };
  }
  try {
    const res = await fetch(URL, { next: { revalidate: 21600 } });
    const j = (await res.json()) as { result?: string; rates?: Record<string, number> };
    if (j.result === "success") {
      const rates = toCompleteRates(j.rates);
      if (rates) {
        cache = { at: Date.now(), rates };
        return { rates, updatedAt: cache.at, source: "live" };
      }
      console.error("getRates: в ответе парсера не хватает валют", SUPPORTED);
    }
  } catch {
    // сеть недоступна — отдаём кэш или запасные курсы
  }
  return cache
    ? { rates: cache.rates, updatedAt: cache.at, source: "cache" }
    : { rates: FALLBACK_RATES, updatedAt: 0, source: "fallback" };
}
