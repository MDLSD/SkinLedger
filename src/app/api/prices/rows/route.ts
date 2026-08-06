import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { parsePriceFilters } from "@/lib/prices/compare";
import { loadComparison } from "@/lib/prices/compare-load";
import { allowedSources, limitsFor } from "@/lib/plan";

// Догрузка строк таблицы сравнения: страница есть только внутри, снаружи это
// одна лента. Фильтры приходят той же строкой запроса, что и в адресе
// страницы, — разбирает их тот же парсер, второй копии правил нет.
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const planUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { plan: true, planUntil: true },
  });
  const limits = limitsFor(planUser);

  const allSources = await prisma.marketSource.findMany({
    where: { isActive: true },
    orderBy: { title: "asc" },
    select: { slug: true, title: true, buyFeePct: true, sellFeePct: true, withdrawFeePct: true },
  });
  const sources = allowedSources(allSources, limits);
  if (!sources.length) {
    return NextResponse.json({ rows: [], hasMore: false });
  }

  const url = new URL(req.url);
  const sp: Record<string, string> = {};
  for (const [k, v] of url.searchParams) sp[k] = v;
  const filters = parsePriceFilters(
    sp,
    sources.map((s) => s.slug),
  );

  const result = await loadComparison(filters, sources, session.user.id, limits.maxItemPrice);
  return NextResponse.json(
    { rows: result.rows, hasMore: result.page < result.pageCount },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
