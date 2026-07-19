// Конвертация валют. Курсы — units валюты за 1 USD (как отдаёт open.er-api).
// Чистые функции без сети (можно на клиенте); фетч — в server-only rates.ts.

export type Rates = Record<string, number>;

// Запасные курсы, если парсер недоступен (примерные, обновляются парсером).
export const FALLBACK_RATES: Rates = { USD: 1, RUB: 90, EUR: 0.92, CNY: 7.1 };

export const CURRENCY_SYMBOL: Record<string, string> = {
  RUB: "₽",
  USD: "$",
  EUR: "€",
  CNY: "¥",
};

/** Множитель: сколько единиц `to` за 1 единицу `from`. */
export function fxFactor(from: string, to: string, rates: Rates): number {
  if (from === to) return 1;
  const rf = rates[from];
  const rt = rates[to];
  if (!rf || !rt) return 1;
  return rt / rf;
}

/** Перевести сумму из валюты `from` в валюту `to`. */
export function convert(amount: number, from: string, to: string, rates: Rates): number {
  return amount * fxFactor(from, to, rates);
}
