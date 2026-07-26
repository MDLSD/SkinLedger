// Серверная выборка таблицы сравнения: тянет котировки пары площадок из БД,
// джойнит по market_hash_name, считает прибыль, фильтрует/сортирует/пагинирует.
import "server-only";
import { prisma } from "@/lib/prisma";
import { computeProfit, type SourceFees } from "./profit";
import {
  PAGE_SIZE,
  PRICE_FIELD,
  type ComparisonResult,
  type ComparisonRow,
  type PriceFilters,
} from "./compare";

const numOrNull = (s: string): number | null => {
  if (!s.trim()) return null;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

const toFees = (s: {
  buyFeePct: unknown;
  sellFeePct: unknown;
  withdrawFeePct: unknown;
}): SourceFees => ({
  buyFeePct: Number(s.buyFeePct),
  sellFeePct: Number(s.sellFeePct),
  withdrawFeePct: Number(s.withdrawFeePct),
});

type SourceRow = {
  slug: string;
  buyFeePct: unknown;
  sellFeePct: unknown;
  withdrawFeePct: unknown;
};

/** Собрать таблицу сравнения для пары площадок с фильтрами/сортировкой/страницей. */
export async function loadComparison(
  f: PriceFilters,
  sources: SourceRow[],
): Promise<ComparisonResult> {
  const bySlug = new Map(sources.map((s) => [s.slug, s]));
  const buySrc = bySlug.get(f.buy);
  const sellSrc = bySlug.get(f.sell);
  if (!buySrc || !sellSrc) {
    return { rows: [], total: 0, page: 1, pageCount: 1, matched: 0 };
  }
  const feesA = toFees(buySrc);
  const feesB = toFees(sellSrc);
  const buyField = PRICE_FIELD[f.buyType];
  const sellField = PRICE_FIELD[f.sellType];

  // Тянем котировки обеих площадок (все поля цен + ликвидность); нужное поле
  // выбираем в JS. Джойним в памяти по market_hash_name. На фейке ~2500 строк
  // на площадку — недорого.
  const [buyQuotes, sellQuotes] = await Promise.all([
    prisma.priceQuote.findMany({
      where: { sourceSlug: f.buy },
      select: { marketHashName: true, priceMin: true, priceAvg30: true, priceMedian30: true },
    }),
    prisma.priceQuote.findMany({
      where: { sourceSlug: f.sell },
      select: {
        marketHashName: true,
        priceMin: true,
        priceAvg30: true,
        priceMedian30: true,
        sales30d: true,
      },
    }),
  ]);

  const sellMap = new Map(sellQuotes.map((q) => [q.marketHashName, q]));
  const priceOf = (
    q: { priceMin: unknown; priceAvg30: unknown; priceMedian30: unknown },
    field: typeof buyField,
  ): number | null => {
    const v = q[field];
    return v == null ? null : Number(v);
  };

  const minP = numOrNull(f.minPrice);
  const maxP = numOrNull(f.maxPrice);
  const minProfit = numOrNull(f.minProfit);
  const minLiq = numOrNull(f.minLiq);
  const qNorm = f.q.trim().toLowerCase();

  let matched = 0;
  const rows: ComparisonRow[] = [];
  for (const bq of buyQuotes) {
    const sq = sellMap.get(bq.marketHashName);
    if (!sq) continue;
    const buyPrice = priceOf(bq, buyField);
    const sellPrice = priceOf(sq, sellField);
    if (buyPrice == null || sellPrice == null) continue;
    if (!Number.isFinite(buyPrice) || !Number.isFinite(sellPrice)) continue;
    matched++;

    if (qNorm && !bq.marketHashName.toLowerCase().includes(qNorm)) continue;
    if (minP != null && buyPrice < minP) continue;
    if (maxP != null && buyPrice > maxP) continue;
    const liquidity = sq.sales30d ?? null;
    if (minLiq != null && (liquidity ?? 0) < minLiq) continue;

    const { profit, profitPct } = computeProfit(buyPrice, sellPrice, feesA, feesB);
    if (minProfit != null && profitPct < minProfit) continue;

    rows.push({
      marketHashName: bq.marketHashName,
      image: null,
      buyPrice,
      sellPrice,
      profit,
      profitPct,
      liquidity,
    });
  }

  // Сортировка.
  const mul = f.dir === "asc" ? 1 : -1;
  rows.sort((a, b) => {
    switch (f.sort) {
      case "name":
        return mul * a.marketHashName.localeCompare(b.marketHashName);
      case "buy":
        return mul * (a.buyPrice - b.buyPrice);
      case "sell":
        return mul * (a.sellPrice - b.sellPrice);
      case "profit":
        return mul * (a.profit - b.profit);
      case "liq":
        return mul * ((a.liquidity ?? 0) - (b.liquidity ?? 0));
      case "profitPct":
      default:
        return mul * (a.profitPct - b.profitPct);
    }
  });

  const total = rows.length;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(f.page, pageCount);
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Картинки только для строк текущей страницы (иначе тянули бы весь каталог).
  const names = pageRows.map((r) => r.marketHashName);
  const items = await prisma.marketItem.findMany({
    where: { marketHashName: { in: names } },
    select: { marketHashName: true, image: true },
  });
  const imgMap = new Map(items.map((i) => [i.marketHashName, i.image]));
  for (const r of pageRows) r.image = imgMap.get(r.marketHashName) ?? null;

  return { rows: pageRows, total, page, pageCount, matched };
}
