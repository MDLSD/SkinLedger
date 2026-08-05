// Переоценка холда по рынку (ТЗ 6): сделки в статусе holding джойнятся
// к котировкам по market_hash_name → «холд сейчас стоит столько-то».
//
// Считаем не «цену витрины», а сколько реально придёт на руки: по каждой
// позиции берём площадку с максимальной выручкой ПОСЛЕ комиссий продажи и
// вывода. Иначе цифра завышена ровно на комиссии, а это деньги.
//
// Сделки без ссылки на каталог (itemId = null — старый импорт со свободным
// текстом) в расчёт не берём: сопоставление по сырому названию даёт ложные
// совпадения, а тут считаются деньги. Их число возвращаем отдельно, чтобы
// показать покрытие честно.
import "server-only";
import { prisma } from "@/lib/prisma";
import { buyCostBase, roundMoney } from "@/lib/deal-math";
import { fxFactor, type Rates } from "@/lib/currency";
import { netSellRevenue, type SourceFees } from "./profit";

export type HoldingMarket = {
  /** Позиций в холде всего и из них с рыночной ценой. */
  positions: number;
  priced: number;
  /** Вложено в оценённые позиции, в базовой валюте. */
  invested: number;
  /** Сколько придёт на руки, если продать их сейчас (после комиссий). */
  marketValue: number;
  profit: number;
  profitPct: number | null;
};

export async function loadHoldingMarket(
  userId: string,
  baseCurrency: string,
  rates: Rates,
): Promise<HoldingMarket> {
  const empty: HoldingMarket = {
    positions: 0,
    priced: 0,
    invested: 0,
    marketValue: 0,
    profit: 0,
    profitPct: null,
  };

  const [positions, deals] = await Promise.all([
    prisma.deal.count({ where: { userId, status: "holding" } }),
    prisma.deal.findMany({
      where: { userId, status: "holding", itemId: { not: null } },
      select: {
        quantity: true,
        buyPrice: true,
        buyFeePct: true,
        buyCurrency: true,
        buyFxRate: true,
        item: { select: { marketHashName: true } },
      },
    }),
  ]);
  if (!positions) return empty;
  if (!deals.length) return { ...empty, positions };

  const names = [...new Set(deals.flatMap((d) => (d.item ? [d.item.marketHashName] : [])))];
  const [quotes, sources] = await Promise.all([
    prisma.priceQuote.findMany({
      where: { marketHashName: { in: names } },
      select: { marketHashName: true, sourceSlug: true, priceMin: true },
    }),
    prisma.marketSource.findMany({
      where: { isActive: true },
      select: { slug: true, sellFeePct: true, withdrawFeePct: true, buyFeePct: true },
    }),
  ]);

  const feesBySlug = new Map<string, SourceFees>(
    sources.map((s) => [
      s.slug,
      {
        buyFeePct: Number(s.buyFeePct),
        sellFeePct: Number(s.sellFeePct),
        withdrawFeePct: Number(s.withdrawFeePct),
      },
    ]),
  );

  // Лучшая выручка за штуку после комиссий, в USD.
  const bestNet = new Map<string, number>();
  for (const q of quotes) {
    const fees = feesBySlug.get(q.sourceSlug);
    const price = q.priceMin == null ? null : Number(q.priceMin);
    if (!fees || price == null) continue;
    const net = netSellRevenue(price, fees);
    const prev = bestNet.get(q.marketHashName);
    if (prev == null || net > prev) bestNet.set(q.marketHashName, net);
  }

  const usdToBase = fxFactor("USD", baseCurrency, rates);
  if (usdToBase == null) return { ...empty, positions };

  let priced = 0;
  let invested = 0;
  let marketValue = 0;

  for (const d of deals) {
    const mhn = d.item?.marketHashName;
    const net = mhn ? bestNet.get(mhn) : undefined;
    if (net == null) continue;

    // Курс покупки: у холда он всегда текущий (закрытых сделок здесь нет).
    const buyFx = fxFactor(d.buyCurrency, baseCurrency, rates);
    if (buyFx == null) continue;

    priced++;
    invested += buyCostBase({
      quantity: d.quantity,
      buyPrice: Number(d.buyPrice),
      buyFeePct: Number(d.buyFeePct),
      buyFxRate: buyFx,
    });
    marketValue += net * d.quantity * usdToBase;
  }

  invested = roundMoney(invested);
  marketValue = roundMoney(marketValue);
  const profit = roundMoney(marketValue - invested);

  return {
    positions,
    priced,
    invested,
    marketValue,
    profit,
    profitPct: invested > 0 ? (profit / invested) * 100 : null,
  };
}
