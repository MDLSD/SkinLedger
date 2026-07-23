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
  monthlyRoi: { label: string; roiPct: number }[];
  cumulative: { label: string; value: number }[];
  marginByHold: { label: string; margin: number | null; count: number }[];
  deadCapital: { amount: number; count: number };
  thisMonthProfit: number;
  topProfit: DealBrief[];
  topLoss: DealBrief[];
  platforms: { name: string; count: number; profit: number; margin: number | null }[];
};

// Корзины по сроку холда (дней) для «маржа vs время холда».
const HOLD_BINS: { label: string; max: number }[] = [
  { label: "≤ 7 дн", max: 7 },
  { label: "8–30 дн", max: 30 },
  { label: "31–60 дн", max: 60 },
  { label: "> 60 дн", max: Infinity },
];
const DEAD_CAPITAL_DAYS = 60;

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
  const holdAgeDays = (d: DashDeal) => (now - d.buyDate.getTime()) / 86_400_000;
  const tradableCount = holding.filter((d) => holdAgeDays(d) >= TRADE_LOCK_DAYS).length;

  // Мёртвый капитал — деньги, застрявшие в холде дольше 60 дней.
  const deadDeals = holding.filter((d) => holdAgeDays(d) > DEAD_CAPITAL_DAYS);
  const deadCapital = {
    amount: roundMoney(deadDeals.reduce((s, d) => s + cost(d), 0)),
    count: deadDeals.length,
  };

  // Прибыль текущего календарного месяца (для личной цели) — вне фильтра периода.
  const nowDate = new Date();
  const thisMonthProfit = roundMoney(
    deals
      .filter(
        (d) =>
          d.status === "sold" &&
          d.sellDate != null &&
          d.sellDate.getFullYear() === nowDate.getFullYear() &&
          d.sellDate.getMonth() === nowDate.getMonth(),
      )
      .reduce((s, d) => s + dealProfit(d), 0),
  );

  // Помесячная прибыль и себестоимость (по дате продажи).
  const byMonth = new Map<string, { profit: number; cost: number }>();
  for (const d of sold) {
    const sd = d.sellDate!;
    const key = `${sd.getFullYear()}-${String(sd.getMonth() + 1).padStart(2, "0")}`;
    const cur = byMonth.get(key) ?? { profit: 0, cost: 0 };
    cur.profit += dealProfit(d);
    cur.cost += cost(d);
    byMonth.set(key, cur);
  }
  const monthlyAll = [...byMonth.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, v]) => {
      const [y, m] = key.split("-").map(Number);
      return {
        key,
        label: `${MONTHS_RU[m - 1]} ${String(y).slice(2)}`,
        profit: roundMoney(v.profit),
        // ROI на вложенный капитал за месяц — главное число для арбитража:
        // прибыль месяца к себестоимости проданного в этом месяце.
        roiPct: v.cost > 0 ? (v.profit / v.cost) * 100 : 0,
      };
    });
  const monthly = monthlyAll.map(({ key, label, profit }) => ({ key, label, profit }));
  const monthlyRoi = monthlyAll.map(({ label, roiPct }) => ({
    label,
    roiPct: Math.round(roiPct * 10) / 10,
  }));
  let run = 0;
  const cumulative = monthly.map((m) => {
    run += m.profit;
    return { label: m.label, value: roundMoney(run) };
  });

  // Маржа vs время холда: по корзинам срока удержания (агрегатная маржа = сумма
  // прибыли к сумме себестоимости в корзине).
  const bins = HOLD_BINS.map((b) => ({ ...b, profit: 0, cost: 0, count: 0 }));
  for (const d of sold) {
    const hd = holdingDays(d.buyDate, d.sellDate);
    const bin = bins.find((b) => hd <= b.max)!;
    bin.profit += dealProfit(d);
    bin.cost += cost(d);
    bin.count += 1;
  }
  const marginByHold = bins.map((b) => ({
    label: b.label,
    margin: b.cost > 0 ? Math.round((b.profit / b.cost) * 1000) / 10 : null,
    count: b.count,
  }));

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

  // Разбивка по площадкам продажи: сделок, прибыль и фактическая маржа
  // (агрегатная — сумма прибыли к сумме себестоимости на площадке).
  const byPlatform = new Map<string, { count: number; profit: number; cost: number }>();
  for (const d of sold) {
    const name = d.sellPlatformName ?? "—";
    const cur = byPlatform.get(name) ?? { count: 0, profit: 0, cost: 0 };
    cur.count += 1;
    cur.profit += dealProfit(d);
    cur.cost += cost(d);
    byPlatform.set(name, cur);
  }
  const platforms = [...byPlatform.entries()]
    .map(([name, v]) => ({
      name,
      count: v.count,
      profit: roundMoney(v.profit),
      margin: v.cost > 0 ? Math.round((v.profit / v.cost) * 1000) / 10 : null,
    }))
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
    monthlyRoi,
    cumulative,
    marginByHold,
    deadCapital,
    thisMonthProfit,
    topProfit,
    topLoss,
    platforms,
  };
}
