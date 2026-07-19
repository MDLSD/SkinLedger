import "server-only";
import { FALLBACK_RATES, type Rates } from "@/lib/currency";

// Парсер курсов валют: тянем с open.er-api.com (бесплатно, без ключа, есть RUB),
// кэшируем в памяти процесса на 6 часов. При недоступности — запасные курсы.
const SUPPORTED = ["USD", "RUB", "EUR", "CNY"];
const TTL_MS = 6 * 3600_000;
const URL = "https://open.er-api.com/v6/latest/USD";

let cache: { at: number; rates: Rates } | null = null;

export type RatesResult = { rates: Rates; updatedAt: number; live: boolean };

export async function getRates(): Promise<RatesResult> {
  if (cache && Date.now() - cache.at < TTL_MS) {
    return { rates: cache.rates, updatedAt: cache.at, live: true };
  }
  try {
    const res = await fetch(URL, { next: { revalidate: 21600 } });
    const j = (await res.json()) as { result?: string; rates?: Record<string, number> };
    if (j.result === "success" && j.rates) {
      const rates: Rates = { USD: 1 };
      for (const c of SUPPORTED) {
        if (typeof j.rates[c] === "number") rates[c] = j.rates[c];
      }
      cache = { at: Date.now(), rates };
      return { rates, updatedAt: cache.at, live: true };
    }
  } catch {
    // сеть недоступна — отдаём кэш или запасные курсы
  }
  return {
    rates: cache?.rates ?? FALLBACK_RATES,
    updatedAt: cache?.at ?? 0,
    live: cache != null,
  };
}
