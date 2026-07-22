// Конвертация валют. Курсы — units валюты за 1 USD (как отдаёт open.er-api).
// Чистые функции без сети (можно на клиенте); фетч — в server-only rates.ts.

import type { Currency } from "@/lib/validation";

export type Rates = Record<string, number>;

// Запасные курсы, если парсер недоступен (примерные, обновляются парсером).
// Тип требует ВСЕ валюты из CURRENCIES: добавили валюту и забыли курс —
// это ошибка компиляции, а не молчаливый пропуск на проде.
export const FALLBACK_RATES: Record<Currency, number> = {
  USD: 1,
  RUB: 90,
  EUR: 0.92,
  CNY: 7.1,
};

export const CURRENCY_SYMBOL: Record<string, string> = {
  RUB: "₽",
  USD: "$",
  EUR: "€",
  CNY: "¥",
};

/**
 * Множитель: сколько единиц `to` за 1 единицу `from`.
 * `null` — курса нет: молча возвращать 1 нельзя, это занижает сумму в разы
 * (500 CNY → 512 ₽ вместо 6 496 ₽). Вызывающий код обязан обработать null.
 */
export function fxFactor(from: string, to: string, rates: Rates): number | null {
  if (from === to) return 1;
  const rf = rates[from];
  const rt = rates[to];
  if (!isUsableRate(rf) || !isUsableRate(rt)) return null;
  return rt / rf;
}

function isUsableRate(v: number | null | undefined): v is number {
  return typeof v === "number" && Number.isFinite(v) && v > 0;
}

/**
 * Курс для расчётов по сделке.
 * Закрытая сделка — прибыль уже реализована, поэтому берём курс,
 * зафиксированный при сохранении: иначе прибыль марта переписывается каждый
 * день, а два скриншота дашборда за разные дни не сходятся.
 * Открытый холд — вложенный капитал ещё не вернулся, его переоцениваем
 * по текущему курсу.
 */
export function dealFxRate(
  closed: boolean,
  stored: number | null,
  currency: string | null,
  base: string,
  rates: Rates,
): number | null {
  if (currency == null) return null;
  // Записи, сделанные до фиксации курса, могли остаться без него — такие
  // считаем по текущему курсу, это прежнее поведение.
  if (closed && isUsableRate(stored)) return stored;
  return fxFactor(currency, base, rates);
}

/** Перевести сумму из валюты `from` в валюту `to` (null — курса нет). */
export function convert(
  amount: number,
  from: string,
  to: string,
  rates: Rates,
): number | null {
  const f = fxFactor(from, to, rates);
  return f == null ? null : amount * f;
}
