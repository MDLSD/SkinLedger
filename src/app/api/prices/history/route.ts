import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isPeriod, type Period } from "@/lib/prices/detail";
import { loadItemDetail } from "@/lib/prices/history";
import { limitsFor } from "@/lib/plan";

// История цен и стакан по предмету для панели, раскрывающейся под строкой
// таблицы. Платная функция (ТЗ 6), поэтому проверка тарифа именно здесь:
// закрыть панель только в интерфейсе — значит оставить данные доступными
// прямым запросом. Графики на публичной странице предмета идут отдельным
// путём и остаются открытыми всем.
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const planUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { plan: true, planUntil: true },
  });
  if (!limitsFor(planUser).charts) {
    return NextResponse.json({ error: "plan" }, { status: 402 });
  }

  const url = new URL(req.url);
  const item = (url.searchParams.get("item") ?? "").slice(0, 200);
  const raw = url.searchParams.get("sources") ?? "";
  const period: Period = isPeriod(url.searchParams.get("period") ?? "")
    ? (url.searchParams.get("period") as Period)
    : "1w";

  if (!item) {
    return NextResponse.json({ error: "item required" }, { status: 400 });
  }

  // Slug'и сверяем со справочником: в запрос из URL идёт только известное.
  const known = new Set(
    (await prisma.marketSource.findMany({ select: { slug: true } })).map((s) => s.slug),
  );
  const slugs = [...new Set(raw.split(",").map((s) => s.trim()))]
    .filter((s) => known.has(s))
    .slice(0, 4);
  if (!slugs.length) {
    return NextResponse.json({ error: "sources required" }, { status: 400 });
  }

  const detail = await loadItemDetail(item, slugs, period);
  return NextResponse.json(detail, {
    headers: { "Cache-Control": "private, max-age=30" },
  });
}
