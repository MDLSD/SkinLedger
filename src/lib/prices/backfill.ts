// Разовая заливка истории цен: график должен работать сразу после подключения
// источника, а не набираться тиками крона неделями. Источник отдаёт кривую за
// N дней (см. PriceSource.fetchHistory), мы кладём её в PriceHistory.
// Без "server-only": модуль запускается скриптом через tsx, где этот импорт
// падает. Серверность и так обеспечена prisma (см. ingest.ts).
import { prisma } from "@/lib/prisma";
import type { PriceSource } from "./source";

export type BackfillResult = {
  items: number;
  sources: number;
  points: number;
  deleted: number;
};

/** Полночь сегодняшнего дня: бэкфилл трогает только прошлое. */
function todayStart(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Залить историю за `days` дней для всех предметов, у которых есть котировки.
 *
 * `replace: false` (по умолчанию) отказывается работать, если история за
 * прошлое уже есть — иначе повторный запуск удвоит точки на графике.
 * `replace: true` сносит всё, что старше сегодняшних суток, и пишет заново;
 * кривая детерминирована, поэтому график после перезаливки тот же.
 */
export async function backfillHistory(
  source: PriceSource,
  days: number,
  opts: { replace?: boolean; onProgress?: (done: number, total: number) => void } = {},
): Promise<BackfillResult> {
  if (!source.fetchHistory) {
    throw new Error("Источник не отдаёт историю: fetchHistory не реализован");
  }

  const cutoff = todayStart();
  const existing = await prisma.priceHistory.count({ where: { ts: { lt: cutoff } } });
  if (existing > 0 && !opts.replace) {
    throw new Error(
      `В price_history уже есть ${existing.toLocaleString("ru-RU")} точек за прошлое. ` +
        "Повторный прогон добавит дубликаты — запустите с HISTORY_REPLACE=1, чтобы перезалить.",
    );
  }

  const deleted = opts.replace
    ? (await prisma.priceHistory.deleteMany({ where: { ts: { lt: cutoff } } })).count
    : 0;

  const [items, sources] = await Promise.all([
    prisma.priceQuote.findMany({
      distinct: ["marketHashName"],
      select: { marketHashName: true },
      orderBy: { marketHashName: "asc" },
    }),
    prisma.marketSource.findMany({ select: { slug: true }, orderBy: { slug: "asc" } }),
  ]);
  const slugs = sources.map((s) => s.slug);
  const names = items.map((i) => i.marketHashName);

  let points = 0;
  // Предметы пачками: и источник не давится, и в памяти не лежит вся история.
  const BATCH = 200;
  const CHUNK = 1000;
  for (let i = 0; i < names.length; i += BATCH) {
    const series = await source.fetchHistory(names.slice(i, i + BATCH), slugs, days);
    const rows = series.flatMap((s) =>
      s.points.map((p) => ({
        marketHashName: s.marketHashName,
        sourceSlug: s.sourceSlug,
        price: p.price,
        ts: p.ts,
      })),
    );
    for (let j = 0; j < rows.length; j += CHUNK) {
      await prisma.priceHistory.createMany({ data: rows.slice(j, j + CHUNK) });
    }
    points += rows.length;
    opts.onProgress?.(Math.min(i + BATCH, names.length), names.length);
  }

  return { items: names.length, sources: slugs.length, points, deleted };
}
