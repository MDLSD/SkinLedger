// Расчётные поля сделки (раздел 4.4 ТЗ). Не хранятся в БД — вычисляются.
// Работает и на клиенте (живой расчёт в форме), и на сервере.

export type DealNumbers = {
  quantity: number;
  buyPrice: number;
  buyFeePct: number;
  buyFxRate: number;
  sellPrice?: number | null;
  sellFeePct?: number | null;
  sellFxRate?: number | null;
};

/**
 * Округление денег до копеек — ЕДИНСТВЕННАЯ точка округления в проекте.
 *
 * Раньше округление происходило только при выводе, а агрегаты складывали
 * неокруглённые значения. Из-за этого «сумма показанных» не сходилась
 * с «показанной суммой»: три сделки по 10,005 ₽ показывались как «10 ₽»
 * каждая, а их сумма — как «30,01 ₽».
 *
 * На точных половинах копейки результат может отличаться от того, что дал бы
 * Intl на сыром числе (умножение на 100 смещает двоичную границу). Это
 * безразлично: округляем ДО вывода, поэтому показывается ровно то значение,
 * которое участвует в суммах.
 */
export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function buyCostBase(d: DealNumbers): number {
  return roundMoney(d.buyPrice * d.quantity * (1 + d.buyFeePct / 100) * d.buyFxRate);
}

export function sellRevenueBase(d: DealNumbers): number | null {
  if (d.sellPrice == null) return null;
  return roundMoney(
    d.sellPrice * d.quantity * (1 - (d.sellFeePct ?? 0) / 100) * (d.sellFxRate ?? 1),
  );
}

export function profit(d: DealNumbers): number | null {
  const revenue = sellRevenueBase(d);
  if (revenue == null) return null;
  // Обе части уже в копейках; повторное округление снимает двоичный шум
  // вычитания, чтобы прибыль в точности равнялась «выручка − затраты».
  return roundMoney(revenue - buyCostBase(d));
}

export function marginPct(d: DealNumbers): number | null {
  const p = profit(d);
  const cost = buyCostBase(d);
  if (p == null || cost === 0) return null;
  return (p / cost) * 100;
}

export function holdingDays(
  buyDate: Date | string,
  sellDate?: Date | string | null,
): number {
  const start = new Date(buyDate);
  const end = sellDate ? new Date(sellDate) : new Date();
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 86_400_000));
}

/**
 * Деньги в формате локали. Символ и расстановка знаков идут из Intl, а не из
 * своей таблицы символов: у русского это «1 500 ₽», у английского «₽1,500» —
 * позиция символа и разделители у локалей разные, вручную это не собрать.
 *
 * `minimumFractionDigits: 0` оставлен намеренно: со стандартными для валюты
 * двумя знаками все суммы получили бы хвост «,00».
 */
export function formatMoney(
  value: number,
  currency = "RUB",
  locale = "ru",
  signed = false,
): string {
  const sign = signed && value > 0 ? "+" : "";
  return (
    sign +
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(value)
  );
}

/** Проценты хранятся как 12.5 (а не 0.125), поэтому делим перед выводом. */
export function formatPct(value: number, locale = "ru"): string {
  return new Intl.NumberFormat(locale, {
    style: "percent",
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(value / 100);
}
