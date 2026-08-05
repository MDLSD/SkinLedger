import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { sourceSlugForPlatform } from "@/lib/prices/platform-source";

// Текущая рыночная цена предмета для подсказки в форме сделки (ТЗ 6).
// Приватный: форма живёт под /app. Отдаёт минимум и медиану по площадкам,
// плюс цену на конкретной площадке сделки, если она сопоставилась с источником.
export const dynamic = "force-dynamic";

type Quote = { slug: string; title: string; price: number };

function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const item = (url.searchParams.get("item") ?? "").slice(0, 200);
  if (!item) return NextResponse.json({ error: "item required" }, { status: 400 });

  // Названия площадок сделки: по ним ищем цену именно на «своей» площадке.
  const platformNames = url.searchParams
    .getAll("platform")
    .map((p) => p.slice(0, 80))
    .slice(0, 2);

  const [quotes, sources] = await Promise.all([
    prisma.priceQuote.findMany({
      where: { marketHashName: item },
      select: { sourceSlug: true, priceMin: true },
    }),
    prisma.marketSource.findMany({
      where: { isActive: true },
      select: { slug: true, title: true },
    }),
  ]);

  const titleBySlug = new Map(sources.map((s) => [s.slug, s.title]));
  const list: Quote[] = quotes
    .flatMap((q) => {
      const title = titleBySlug.get(q.sourceSlug);
      const price = q.priceMin == null ? null : Number(q.priceMin);
      return title && price != null ? [{ slug: q.sourceSlug, title, price }] : [];
    })
    .sort((a, b) => a.price - b.price);

  const priceBySlug = new Map(list.map((q) => [q.slug, q]));
  const platforms = platformNames.map((name) => {
    const slug = sourceSlugForPlatform(name, sources);
    const hit = slug ? priceBySlug.get(slug) : null;
    return { name, price: hit?.price ?? null, title: hit?.title ?? null };
  });

  return NextResponse.json({
    item,
    low: list.length ? list[0].price : null,
    lowTitle: list.length ? list[0].title : null,
    median: median(list.map((q) => q.price)),
    count: list.length,
    platforms,
  });
}
