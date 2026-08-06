// Серверная выборка данных для панели предмета: история цен из PriceHistory
// (её пишет каждый тик загрузчика) + текущий стакан из PriceQuote.
import "server-only";
import { prisma } from "@/lib/prisma";
import {
  periodDays,
  type ItemDetail,
  type Period,
  type SourceDetail,
} from "./detail";

/**
 * История и стакан по предмету на нескольких площадках за период.
 *
 * `includeHistory: false` — для бесплатного тарифа: сам запрос к истории не
 * выполняется, а не выполняется и отбрасывается. Стакан отдаётся: это те же
 * текущие цены, что уже стоят в строке таблицы, скрывать их не от чего.
 */
export async function loadItemDetail(
  item: string,
  slugs: string[],
  period: Period,
  includeHistory = true,
): Promise<ItemDetail> {
  const days = periodDays(period);
  const since = days == null ? undefined : new Date(Date.now() - days * 86400_000);

  const [history, quotes] = await Promise.all([
    includeHistory
      ? prisma.priceHistory.findMany({
          where: {
            marketHashName: item,
            sourceSlug: { in: slugs },
            ...(since ? { ts: { gte: since } } : {}),
          },
          orderBy: { ts: "asc" },
          select: { sourceSlug: true, price: true, ts: true },
        })
      : [],
    prisma.priceQuote.findMany({
      where: { marketHashName: item, sourceSlug: { in: slugs } },
      select: { sourceSlug: true, priceMin: true, priceOrder: true, offersCount: true },
    }),
  ]);

  const quoteBySlug = new Map(quotes.map((q) => [q.sourceSlug, q]));

  const sources: SourceDetail[] = slugs.map((slug) => {
    const points = history
      .filter((h) => h.sourceSlug === slug)
      .map((h) => ({ t: h.ts.getTime(), p: Number(h.price) }))
      .filter((p) => Number.isFinite(p.p));

    let min: number | null = null;
    let max: number | null = null;
    let sum = 0;
    for (const { p } of points) {
      if (min == null || p < min) min = p;
      if (max == null || p > max) max = p;
      sum += p;
    }

    const q = quoteBySlug.get(slug);
    const sellPrice = q?.priceMin == null ? null : Number(q.priceMin);
    const buyPrice = q?.priceOrder == null ? null : Number(q.priceOrder);

    return {
      sourceSlug: slug,
      points,
      min,
      max,
      avg: points.length ? sum / points.length : null,
      // Стакана целиком источник не отдаёт — знаем только лучший уровень с
      // каждой стороны: минимальный листинг и цену ордера.
      sell: sellPrice == null ? null : { price: sellPrice, count: q?.offersCount ?? null },
      buy: buyPrice == null ? null : { price: buyPrice, count: null },
    };
  });

  return { item, period, sources, ...(includeHistory ? {} : { locked: true }) };
}
