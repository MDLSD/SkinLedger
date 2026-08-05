// Топ связок «где купить → где продать» по всему каталогу (ТЗ раздел 5).
//
// Наивный перебор пар площадок — O(предметы × площадки²). Вместо него для
// каждого предмета держим ДВА лучших варианта покупки и продажи: лучшая связка
// — это либо (самая дешёвая покупка + самая дорогая продажа), либо, если это
// одна и та же площадка, одна из двух комбинаций со вторыми местами. Получается
// линейно по числу площадок, что важно на реальном каталоге в 33 тысячи
// предметов, а не на фейковых 2 500.
import "server-only";
import { prisma } from "@/lib/prisma";
import { netBuyCost, netSellRevenue, type SourceFees } from "./profit";
import {
  SPREADS_PAGE_SIZE,
  type SpreadFilters,
  type SpreadRow,
  type SpreadsResult,
} from "./spreads";

const numOrNull = (s: string): number | null => {
  if (!s.trim()) return null;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

/** Два лучших значения с их площадками: нужны, когда покупка и продажа совпали. */
type Best2 = { slug: string; value: number }[];

function push2(list: Best2, slug: string, value: number, better: (a: number, b: number) => boolean) {
  if (list.length === 0 || better(value, list[0].value)) {
    list.unshift({ slug, value });
    if (list.length > 2) list.pop();
    return;
  }
  if (list.length === 1 || better(value, list[1].value)) {
    list[1] = { slug, value };
  }
}

export async function loadSpreads(
  f: SpreadFilters,
  userId: string,
): Promise<SpreadsResult> {
  const [quotes, sources, watch] = await Promise.all([
    prisma.priceQuote.findMany({
      select: {
        marketHashName: true,
        sourceSlug: true,
        priceMin: true,
        sales30d: true,
      },
    }),
    prisma.marketSource.findMany({
      where: { isActive: true },
      select: {
        slug: true,
        title: true,
        buyFeePct: true,
        sellFeePct: true,
        withdrawFeePct: true,
      },
    }),
    prisma.watchItem.findMany({
      where: { userId },
      select: { marketHashName: true, kind: true },
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
  const titleBySlug = new Map(sources.map((s) => [s.slug, s.title]));
  const watchBy = new Map(watch.map((w) => [w.marketHashName, w.kind]));

  // Сводим котировки по предмету: цена покупки (после комиссии покупки) и
  // выручка продажи (после комиссий продажи и вывода) — сразу в «чистых».
  type Agg = {
    buys: Best2; // минимальная чистая покупка
    sells: Best2; // максимальная чистая выручка
    rawBuy: Map<string, number>; // цена витрины, чтобы показать её в строке
    rawSell: Map<string, number>;
    sales: Map<string, number | null>;
  };
  const byItem = new Map<string, Agg>();

  for (const q of quotes) {
    const fees = feesBySlug.get(q.sourceSlug);
    const price = q.priceMin == null ? null : Number(q.priceMin);
    if (!fees || price == null || !Number.isFinite(price)) continue;

    let agg = byItem.get(q.marketHashName);
    if (!agg) {
      agg = { buys: [], sells: [], rawBuy: new Map(), rawSell: new Map(), sales: new Map() };
      byItem.set(q.marketHashName, agg);
    }
    push2(agg.buys, q.sourceSlug, netBuyCost(price, fees), (a, b) => a < b);
    push2(agg.sells, q.sourceSlug, netSellRevenue(price, fees), (a, b) => a > b);
    agg.rawBuy.set(q.sourceSlug, price);
    agg.rawSell.set(q.sourceSlug, price);
    agg.sales.set(q.sourceSlug, q.sales30d ?? null);
  }

  const minProfit = numOrNull(f.minProfit);
  const minLiq = numOrNull(f.minLiq);
  const minP = numOrNull(f.minPrice);
  const maxP = numOrNull(f.maxPrice);
  const qNorm = f.q.trim().toLowerCase();

  let matched = 0;
  const rows: SpreadRow[] = [];

  for (const [item, agg] of byItem) {
    if (agg.buys.length < 1 || agg.sells.length < 1) continue;

    // Лучшая пара с разными площадками.
    let pair: { buy: { slug: string; value: number }; sell: { slug: string; value: number } } | null =
      null;
    if (agg.buys[0].slug !== agg.sells[0].slug) {
      pair = { buy: agg.buys[0], sell: agg.sells[0] };
    } else {
      const a = agg.sells[1] ? { buy: agg.buys[0], sell: agg.sells[1] } : null;
      const b = agg.buys[1] ? { buy: agg.buys[1], sell: agg.sells[0] } : null;
      const profitOf = (p: typeof a) => (p ? p.sell.value - p.buy.value : -Infinity);
      pair = profitOf(a) >= profitOf(b) ? a : b;
    }
    if (!pair) continue; // предмет есть только на одной площадке
    matched++;

    const watchKind = watchBy.get(item) ?? null;
    if (watchKind === "blocked") continue;
    if (f.fav && watchKind !== "favorite") continue;
    if (qNorm && !item.toLowerCase().includes(qNorm)) continue;

    const buyPrice = agg.rawBuy.get(pair.buy.slug);
    const sellPrice = agg.rawSell.get(pair.sell.slug);
    if (buyPrice == null || sellPrice == null) continue;
    if (minP != null && buyPrice < minP) continue;
    if (maxP != null && buyPrice > maxP) continue;

    const liquidity = agg.sales.get(pair.sell.slug) ?? null;
    if (minLiq != null && (liquidity ?? 0) < minLiq) continue;

    const profit = pair.sell.value - pair.buy.value;
    const profitPct = pair.buy.value > 0 ? (profit / pair.buy.value) * 100 : 0;
    if (minProfit != null && profitPct < minProfit) continue;

    rows.push({
      marketHashName: item,
      slug: null,
      image: null,
      titleTop: "",
      kind: "skin",
      titleMain: item,
      buySlug: pair.buy.slug,
      buyTitle: titleBySlug.get(pair.buy.slug) ?? pair.buy.slug,
      buyPrice,
      sellSlug: pair.sell.slug,
      sellTitle: titleBySlug.get(pair.sell.slug) ?? pair.sell.slug,
      sellPrice,
      profit,
      profitPct,
      liquidity,
      favorite: watchKind === "favorite",
    });
  }

  const mul = f.dir === "asc" ? 1 : -1;
  rows.sort((a, b) => {
    switch (f.sort) {
      case "profit":
        return mul * (a.profit - b.profit);
      case "buy":
        return mul * (a.buyPrice - b.buyPrice);
      case "liq":
        return mul * ((a.liquidity ?? 0) - (b.liquidity ?? 0));
      case "profitPct":
      default:
        return mul * (a.profitPct - b.profitPct);
    }
  });

  const total = rows.length;
  const pageCount = Math.max(1, Math.ceil(total / SPREADS_PAGE_SIZE));
  const page = Math.min(f.page, pageCount);
  const pageRows = rows.slice((page - 1) * SPREADS_PAGE_SIZE, page * SPREADS_PAGE_SIZE);

  // Названия и картинки — только для текущей страницы.
  const items = await prisma.marketItem.findMany({
    where: { marketHashName: { in: pageRows.map((r) => r.marketHashName) } },
    select: {
      marketHashName: true,
      slug: true,
      image: true,
      kind: true,
      weapon: true,
      skinName: true,
      stickerName: true,
      wear: true,
    },
  });
  const itemBy = new Map(items.map((i) => [i.marketHashName, i]));
  for (const r of pageRows) {
    const it = itemBy.get(r.marketHashName);
    if (!it) continue;
    r.slug = it.slug;
    r.image = it.image;
    r.kind = it.kind;
    if (it.kind === "skin") {
      r.titleTop = it.weapon ?? "";
      r.titleMain =
        [it.skinName, it.wear && `(${it.wear})`].filter(Boolean).join(" ") || r.marketHashName;
    } else {
      r.titleTop = "";
      r.titleMain = it.stickerName ?? it.skinName ?? r.marketHashName;
    }
  }

  return { rows: pageRows, total, page, pageCount, matched };
}
