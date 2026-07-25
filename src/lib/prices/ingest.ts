// Загрузчик цен: тянет из источника → нормализует → пишет в БД. Один тик:
// перезаписывает PriceQuote (срез) + дописывает PriceHistory. Идемпотентно.
// Тот же ingestPrices() вызывается и из CLI, и из крона на деплое.
import { prisma } from "@/lib/prisma";
import { DEFAULT_SOURCES } from "./sources";
import type { PriceSource } from "./source";

const MIN_USD = 0.5; // отсечка дешёвых при записи (дублирует отсечку источника)

/** Завести дефолтные площадки, если их ещё нет (комиссии при апдейте не трогаем). */
export async function ensureSources(): Promise<void> {
  for (const s of DEFAULT_SOURCES) {
    await prisma.marketSource.upsert({
      where: { slug: s.slug },
      create: {
        slug: s.slug,
        title: s.title,
        currency: s.currency,
        buyFeePct: s.buyFeePct,
        sellFeePct: s.sellFeePct,
        withdrawFeePct: s.withdrawFeePct,
      },
      update: { title: s.title, currency: s.currency },
    });
  }
}

export type IngestResult = {
  sources: number;
  items: number;
  quotes: number;
  history: number;
};

export async function ingestPrices(source: PriceSource): Promise<IngestResult> {
  const active = await prisma.marketSource.findMany({
    where: { isActive: true },
    select: { slug: true },
  });
  const slugs = active.map((s) => s.slug);
  const items = await source.fetchPrices(slugs);
  const now = new Date();

  type Q = {
    marketHashName: string;
    sourceSlug: string;
    priceMin: number | null;
    priceOrder: number | null;
    priceAvg30: number | null;
    priceMedian30: number | null;
    offersCount: number | null;
    sales30d: number | null;
    fetchedAt: Date;
  };
  const quoteRows: Q[] = [];
  const histRows: { marketHashName: string; sourceSlug: string; price: number; ts: Date }[] = [];

  for (const it of items) {
    for (const p of it.prices) {
      if (p.priceMin != null && p.priceMin < MIN_USD) continue;
      quoteRows.push({
        marketHashName: it.marketHashName,
        sourceSlug: p.sourceSlug,
        priceMin: p.priceMin,
        priceOrder: p.priceOrder,
        priceAvg30: p.priceAvg30,
        priceMedian30: p.priceMedian30,
        offersCount: p.offersCount,
        sales30d: p.sales30d,
        fetchedAt: now,
      });
      if (p.priceMin != null) {
        histRows.push({ marketHashName: it.marketHashName, sourceSlug: p.sourceSlug, price: p.priceMin, ts: now });
      }
    }
  }

  const CHUNK = 500;
  for (let i = 0; i < quoteRows.length; i += CHUNK) {
    const chunk = quoteRows.slice(i, i + CHUNK);
    await prisma.$transaction(
      chunk.map((r) =>
        prisma.priceQuote.upsert({
          where: { marketHashName_sourceSlug: { marketHashName: r.marketHashName, sourceSlug: r.sourceSlug } },
          create: r,
          update: {
            priceMin: r.priceMin,
            priceOrder: r.priceOrder,
            priceAvg30: r.priceAvg30,
            priceMedian30: r.priceMedian30,
            offersCount: r.offersCount,
            sales30d: r.sales30d,
            fetchedAt: r.fetchedAt,
          },
        }),
      ),
    );
  }
  for (let i = 0; i < histRows.length; i += CHUNK) {
    await prisma.priceHistory.createMany({ data: histRows.slice(i, i + CHUNK) });
  }

  return { sources: slugs.length, items: items.length, quotes: quoteRows.length, history: histRows.length };
}
