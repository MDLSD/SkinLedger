// Агрегаты дашборда. Чистая функция (без Prisma) — считает по уже
// загруженным сделкам. Прибыль/оборот/маржа — по закрытым (sold) сделкам,
// потери на выводе — отдельно, заморожено в холде — снимок (без периода).
import {
  buyCostBase,
  holdingDays,
  marginPct,
  profit,
  roundMoney,
  sellRevenueBase,
} from "@/lib/deal-math";

const TRADE_LOCK_DAYS = 7;

export type DashDeal = {
  id: string;
  itemName: string;
  itemQuality: string | null;
  status: string;
  buyDate: Date;
  sellDate: Date | null;
  quantity: number;
  buyPrice: number;
  buyFeePct: number;
  buyFxRate: number;
  sellPrice: number | null;
  sellFeePct: number | null;
  sellFxRate: number | null;
  sellPlatformName: string | null;
};

export type DealBrief = {
  id: string;
  itemName: string;
  itemQuality: string | null;
  profit: number;
  margin: number | null;
};

export type DashboardData = {
  cards: {
    netProfit: number;
    turnover: number;
    roiPct: number | null;
    avgMargin: number | null;
    avgProfitPerDeal: number | null;
    bestTrade: number | null;
    avgHoldDays: number | null;
    closedCount: number;
    frozenInHolding: number;
    holdingCount: number;
    tradableCount: number;
  };
  monthly: { key: string; label: string; profit: number }[];
  cumulative: { label: string; value: number }[];
  topProfit: DealBrief[];
  topLoss: DealBrief[];
  platforms: { name: string; count: number; profit: number }[];
};

const MONTHS_RU = [
  "янв", "фев", "мар", "апр", "май", "июн",
  "июл", "авг", "сен", "окт", "ноя", "дек",
];

function inRange(d: Date | null, range: { gte?: Date; lte?: Date } | null): boolean {
  if (!d) return false;
  if (!range) return true;
  if (range.gte && d < range.gte) return false;
  if (range.lte && d > range.lte) return false;
  return true;
}

export function computeDashboard(
  deals: DashDeal[],
  range: { gte?: Date; lte?: Date } | null,
): DashboardData {
  const cost = (d: DashDeal) =>
    buyCostBase({ quantity: d.quantity, buyPrice: d.buyPrice, buyFeePct: d.buyFeePct, buyFxRate: d.buyFxRate });
  const revenue = (d: DashDeal) =>
    sellRevenueBase({
      quantity: d.quantity, buyPrice: d.buyPrice, buyFeePct: d.buyFeePct, buyFxRate: d.buyFxRate,
      sellPrice: d.sellPrice, sellFeePct: d.sellFeePct, sellFxRate: d.sellFxRate,
    }) ?? 0;
  const dealProfit = (d: DashDeal) =>
    profit({
      quantity: d.quantity, buyPrice: d.buyPrice, buyFeePct: d.buyFeePct, buyFxRate: d.buyFxRate,
      sellPrice: d.sellPrice, sellFeePct: d.sellFeePct, sellFxRate: d.sellFxRate,
    }) ?? 0;

  // Закрытые торговые сделки за период (по дате продажи).
  const sold = deals.filter((d) => d.status === "sold" && inRange(d.sellDate, range));
  const holding = deals.filter((d) => d.status === "holding");

  // Слагаемые уже в копейках (округляет deal-math), но сумма многих таких
  // значений накапливает двоичный шум — снимаем его той же функцией.
  const netProfit = roundMoney(sold.reduce((s, d) => s + dealProfit(d), 0));
  const turnover = roundMoney(sold.reduce((s, d) => s + revenue(d), 0));
  const totalCost = roundMoney(sold.reduce((s, d) => s + cost(d), 0));
  // Прибыль ко всей себестоимости — это ROI портфеля, а не среднее по сделкам:
  // сделка на 100 000 ₽ влияет на него в сто раз сильнее сделки на 1 000 ₽.
  // Подпись на карточке говорит именно про рентабельность, чтобы значение
  // не сверяли с колонкой «Маржа» в списке.
  const roiPct = totalCost > 0 ? (netProfit / totalCost) * 100 : null;
  const frozenInHolding = roundMoney(holding.reduce((s, d) => s + cost(d), 0));

  // Средняя маржа по сделке (среднее из маржей, а не портфельный ROI).
  const margins = sold
    .map((d) => marginPct({ quantity: d.quantity, buyPrice: d.buyPrice, buyFeePct: d.buyFeePct, buyFxRate: d.buyFxRate, sellPrice: d.sellPrice, sellFeePct: d.sellFeePct, sellFxRate: d.sellFxRate }))
    .filter((m): m is number => m != null);
  const avgMargin = margins.length ? margins.reduce((s, m) => s + m, 0) / margins.length : null;

  // Средняя прибыль на закрытую сделку.
  const avgProfitPerDeal = sold.length ? roundMoney(netProfit / sold.length) : null;

  // Лучшая сделка за период (максимальная прибыль одной сделки).
  const bestTrade = sold.length
    ? roundMoney(Math.max(...sold.map((d) => dealProfit(d))))
    : null;

  // Средний срок сделки в днях (от покупки до продажи).
  const avgHoldDays = sold.length
    ? Math.round(sold.reduce((s, d) => s + holdingDays(d.buyDate, d.sellDate), 0) / sold.length)
    : null;

  // Холд: сколько позиций и сколько уже вышли из трейд-бана (7 дней).
  const now = Date.now();
  const tradableCount = holding.filter(
    (d) => (now - d.buyDate.getTime()) / 86_400_000 >= TRADE_LOCK_DAYS,
  ).length;

  // Помесячная торговая прибыль (по дате продажи) + кумулятивная.
  const byMonth = new Map<string, number>();
  for (const d of sold) {
    const sd = d.sellDate!;
    const key = `${sd.getFullYear()}-${String(sd.getMonth() + 1).padStart(2, "0")}`;
    byMonth.set(key, (byMonth.get(key) ?? 0) + dealProfit(d));
  }
  const monthly = [...byMonth.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, p]) => {
      const [y, m] = key.split("-").map(Number);
      return {
        key,
        label: `${MONTHS_RU[m - 1]} ${String(y).slice(2)}`,
        profit: roundMoney(p),
      };
    });
  let run = 0;
  const cumulative = monthly.map((m) => {
    run += m.profit;
    return { label: m.label, value: roundMoney(run) };
  });

  const briefs = (arr: DashDeal[]): DealBrief[] =>
    arr.map((d) => ({
      id: d.id,
      itemName: d.itemName,
      itemQuality: d.itemQuality,
      profit: dealProfit(d),
      margin: marginPct({
        quantity: d.quantity, buyPrice: d.buyPrice, buyFeePct: d.buyFeePct, buyFxRate: d.buyFxRate,
        sellPrice: d.sellPrice, sellFeePct: d.sellFeePct, sellFxRate: d.sellFxRate,
      }),
    }));
  const sortedByProfit = briefs(sold).sort((a, b) => b.profit - a.profit);
  const topProfit = sortedByProfit.slice(0, 5).filter((d) => d.profit > 0);
  const topLoss = [...sortedByProfit].reverse().slice(0, 5).filter((d) => d.profit < 0);

  // Разбивка прибыли по площадкам продажи.
  const byPlatform = new Map<string, { count: number; profit: number }>();
  for (const d of sold) {
    const name = d.sellPlatformName ?? "—";
    const cur = byPlatform.get(name) ?? { count: 0, profit: 0 };
    cur.count += 1;
    cur.profit += dealProfit(d);
    byPlatform.set(name, cur);
  }
  const platforms = [...byPlatform.entries()]
    .map(([name, v]) => ({ ...v, name, profit: roundMoney(v.profit) }))
    .sort((a, b) => b.profit - a.profit);

  return {
    cards: {
      netProfit,
      turnover,
      roiPct,
      avgMargin,
      avgProfitPerDeal,
      bestTrade,
      avgHoldDays,
      closedCount: sold.length,
      frozenInHolding,
      holdingCount: holding.length,
      tradableCount,
    },
    monthly,
    cumulative,
    topProfit,
    topLoss,
    platforms,
  };
}
