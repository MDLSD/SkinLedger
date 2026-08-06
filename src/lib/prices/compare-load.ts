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
  userId?: string,
  /** Потолок цены покупки бесплатного тарифа, USD; null — без потолка. */
  maxItemPrice?: number | null,
): Promise<ComparisonResult> {
  const now = Date.now();
  const bySlug = new Map(sources.map((s) => [s.slug, s]));
  const buySrc = bySlug.get(f.buy);
  const sellSrc = bySlug.get(f.sell);
  if (!buySrc || !sellSrc) {
    return { rows: [], total: 0, page: 1, pageCount: 1, matched: 0, now };
  }
  const feesA = toFees(buySrc);
  const feesB = toFees(sellSrc);
  const buyField = PRICE_FIELD[f.buyType] ?? "priceMin";
  const sellField = PRICE_FIELD[f.sellType] ?? "priceMin";

  // Тянем котировки обеих площадок (все поля цен + ликвидность); нужное поле
  // выбираем в JS. Джойним в памяти по market_hash_name. На фейке ~2500 строк
  // на площадку — недорого.
  const [buyQuotes, sellQuotes] = await Promise.all([
    prisma.priceQuote.findMany({
      where: { sourceSlug: f.buy },
      select: {
        marketHashName: true,
        priceMin: true,
        priceOrder: true,
        priceAvg30: true,
        priceMedian30: true,
        offersCount: true,
        sales30d: true,
        fetchedAt: true,
      },
    }),
    prisma.priceQuote.findMany({
      where: { sourceSlug: f.sell },
      select: {
        marketHashName: true,
        priceMin: true,
        priceOrder: true,
        priceAvg30: true,
        priceMedian30: true,
        offersCount: true,
        sales30d: true,
        fetchedAt: true,
      },
    }),
  ]);

  // Списки пользователя: чёрный список прячем всегда, избранное — фильтр.
  const watch = userId
    ? await prisma.watchItem.findMany({
        where: { userId },
        select: { marketHashName: true, kind: true },
      })
    : [];
  const watchBy = new Map(watch.map((w) => [w.marketHashName, w.kind]));

  const sellMap = new Map(sellQuotes.map((q) => [q.marketHashName, q]));
  const priceOf = (
    q: { priceMin: unknown; priceOrder: unknown; priceAvg30: unknown; priceMedian30: unknown },
    field: typeof buyField,
  ): number | null => {
    const v = q[field];
    return v == null ? null : Number(v);
  };

  const buyMinP = numOrNull(f.buyMinPrice);
  const buyMaxP = numOrNull(f.buyMaxPrice);
  const buyMinQ = numOrNull(f.buyMinQty);
  const buyMaxQ = numOrNull(f.buyMaxQty);
  const sellMinP = numOrNull(f.sellMinPrice);
  const sellMaxP = numOrNull(f.sellMaxPrice);
  const sellMinQ = numOrNull(f.sellMinQty);
  const sellMaxQ = numOrNull(f.sellMaxQty);
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

    const watchKind = watchBy.get(bq.marketHashName) ?? null;
    // Чёрный список — это «больше не показывай», поэтому до фильтров.
    if (watchKind === "blocked") continue;
    if (f.fav && watchKind !== "favorite") continue;

    if (qNorm && !bq.marketHashName.toLowerCase().includes(qNorm)) continue;
    // Потолок бесплатного тарифа — до пользовательских фильтров.
    if (maxItemPrice != null && buyPrice > maxItemPrice) continue;
    if (buyMinP != null && buyPrice < buyMinP) continue;
    if (buyMaxP != null && buyPrice > buyMaxP) continue;
    if (sellMinP != null && sellPrice < sellMinP) continue;
    if (sellMaxP != null && sellPrice > sellMaxP) continue;

    // Количество — число предложений на площадке.
    const buyQty = bq.offersCount ?? null;
    const sellQty = sq.offersCount ?? null;
    if (buyMinQ != null && (buyQty ?? 0) < buyMinQ) continue;
    if (buyMaxQ != null && (buyQty ?? 0) > buyMaxQ) continue;
    if (sellMinQ != null && (sellQty ?? 0) < sellMinQ) continue;
    if (sellMaxQ != null && (sellQty ?? 0) > sellMaxQ) continue;

    const liquidity = sq.sales30d ?? null;
    if (minLiq != null && (liquidity ?? 0) < minLiq) continue;

    const { profit, profitPct } = computeProfit(buyPrice, sellPrice, feesA, feesB);
    if (minProfit != null && profitPct < minProfit) continue;

    rows.push({
      marketHashName: bq.marketHashName,
      slug: null,
      watch: watchKind === "favorite" || watchKind === "blocked" ? watchKind : null,
      image: null,
      titleTop: "",
      titleMain: bq.marketHashName,
      stattrak: false,
      souvenir: false,
      buyPrice,
      sellPrice,
      buyOffers: bq.offersCount ?? null,
      sellOffers: sq.offersCount ?? null,
      buyFetchedAt: bq.fetchedAt,
      sellFetchedAt: sq.fetchedAt,
      buySales: bq.sales30d ?? null,
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
    select: {
      marketHashName: true,
      slug: true,
      image: true,
      kind: true,
      weapon: true,
      skinName: true,
      wear: true,
      stickerName: true,
      stattrak: true,
      souvenir: true,
    },
  });
  const itemMap = new Map(items.map((i) => [i.marketHashName, i]));
  for (const r of pageRows) {
    const it = itemMap.get(r.marketHashName);
    if (!it) continue;
    r.image = it.image ?? null;
    r.slug = it.slug;
    r.stattrak = it.stattrak;
    r.souvenir = it.souvenir;
    if (it.kind === "skin") {
      r.titleTop = it.weapon || "";
      const main = [it.skinName, it.wear && `(${it.wear})`].filter(Boolean).join(" ");
      r.titleMain = main || r.marketHashName;
    } else {
      // Ключ вида предмета; подпись подставляет компонент строки.
      r.titleTop = it.kind;
      r.titleMain =
        it.stickerName ?? it.skinName ?? r.marketHashName.replace(/^Sticker \| /, "");
    }
  }

  return { rows: pageRows, total, page, pageCount, matched, now };
}
