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

export function buyCostBase(d: DealNumbers): number {
  return d.buyPrice * d.quantity * (1 + d.buyFeePct / 100) * d.buyFxRate;
}

export function sellRevenueBase(d: DealNumbers): number | null {
  if (d.sellPrice == null) return null;
  return (
    d.sellPrice * d.quantity * (1 - (d.sellFeePct ?? 0) / 100) * (d.sellFxRate ?? 1)
  );
}

export function profit(d: DealNumbers): number | null {
  const revenue = sellRevenueBase(d);
  if (revenue == null) return null;
  return revenue - buyCostBase(d);
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

const currencySymbols: Record<string, string> = {
  RUB: "₽",
  USD: "$",
  EUR: "€",
  CNY: "¥",
};

export function formatMoney(value: number, currency = "RUB", signed = false): string {
  const sign = signed && value > 0 ? "+" : "";
  const num = new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
  return `${sign}${num} ${currencySymbols[currency] ?? currency}`;
}

export function formatPct(value: number): string {
  return `${new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(value)} %`;
}
