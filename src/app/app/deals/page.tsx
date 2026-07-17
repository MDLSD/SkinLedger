import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { DealsClient } from "@/components/deals-client";
import { holdingDays, marginPct, profit } from "@/lib/deal-math";
import {
  PAGE_SIZE,
  parseDealFilters,
  periodRange,
  type SortKey,
} from "@/lib/deal-list";
import type { DealDTO, PlatformDTO } from "@/lib/types";

export const metadata: Metadata = { title: "Сделки — SkinLedger" };

// Верхняя граница выборки в память (NFR: < 1 с при 5000 сделок).
const MAX_ROWS = 5000;

function toDateStr(d: Date | null): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function DealsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;
  const filters = parseDealFilters(await searchParams);

  // Фильтры, сводимые к SQL: статус, площадка, период (по дате покупки).
  const where: Record<string, unknown> = { userId };
  if (filters.status !== "all") where.status = filters.status;
  if (filters.platform !== "all") {
    where.OR = [
      { buyPlatformId: filters.platform },
      { sellPlatformId: filters.platform },
    ];
  }
  const range = periodRange(filters);
  if (range) where.buyDate = range;

  const [user, platformRows, dealRows] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId } }),
    prisma.platform.findMany({
      where: { OR: [{ isCustom: false }, { userId }] },
      orderBy: [{ isCustom: "asc" }, { name: "asc" }],
    }),
    prisma.deal.findMany({
      where,
      include: { buyPlatform: true, sellPlatform: true, item: true },
      take: MAX_ROWS,
    }),
  ]);

  const platforms: PlatformDTO[] = platformRows.map((p) => ({
    id: p.id,
    name: p.name,
    defaultBuyFeePct: Number(p.defaultBuyFeePct),
    defaultSellFeePct: Number(p.defaultSellFeePct),
    isCustom: p.isCustom,
  }));

  let all: DealDTO[] = dealRows.map((d) => ({
    id: d.id,
    itemName: d.itemName,
    itemQuality: d.itemQuality,
    quantity: d.quantity,
    buyPlatformId: d.buyPlatformId,
    buyPlatformName: d.buyPlatform.name,
    buyPrice: Number(d.buyPrice),
    buyCurrency: d.buyCurrency,
    buyFxRate: Number(d.buyFxRate),
    buyFeePct: Number(d.buyFeePct),
    buyDate: toDateStr(d.buyDate)!,
    status: d.status,
    sellPlatformId: d.sellPlatformId,
    sellPlatformName: d.sellPlatform?.name ?? null,
    sellPrice: d.sellPrice != null ? Number(d.sellPrice) : null,
    sellCurrency: d.sellCurrency,
    sellFxRate: d.sellFxRate != null ? Number(d.sellFxRate) : null,
    sellFeePct: d.sellFeePct != null ? Number(d.sellFeePct) : null,
    sellDate: toDateStr(d.sellDate),
    note: d.note,
    itemId: d.itemId,
    itemFamilyId: d.item?.familyId ?? null,
    itemKind: d.item?.kind ?? null,
    itemStattrak: d.item?.stattrak ?? false,
    itemSouvenir: d.item?.souvenir ?? false,
  }));

  // Поиск по названию (регистронезависимо; SQLite LIKE не покрывает кириллицу).
  if (filters.q.trim()) {
    const q = filters.q.trim().toLowerCase();
    all = all.filter((d) => d.itemName.toLowerCase().includes(q));
  }

  // Сортировка — в т.ч. по вычисляемым полям (прибыль/маржа/дни).
  const num = (v: number | null, dir: number) =>
    v == null ? dir * -Infinity : v; // null всегда в конец
  const sortDir = filters.dir === "asc" ? 1 : -1;
  const comparators: Record<SortKey, (a: DealDTO, b: DealDTO) => number> = {
    item: (a, b) => a.itemName.localeCompare(b.itemName, "ru"),
    buyPrice: (a, b) => a.buyPrice - b.buyPrice,
    sellPrice: (a, b) => num(a.sellPrice, -sortDir) - num(b.sellPrice, -sortDir),
    profit: (a, b) =>
      num(profit(a), -sortDir) - num(profit(b), -sortDir),
    margin: (a, b) =>
      num(marginPct(a), -sortDir) - num(marginPct(b), -sortDir),
    days: (a, b) =>
      holdingDays(a.buyDate, a.sellDate) - holdingDays(b.buyDate, b.sellDate),
    status: (a, b) => a.status.localeCompare(b.status),
    buyDate: (a, b) => a.buyDate.localeCompare(b.buyDate),
  };
  all.sort((a, b) => sortDir * comparators[filters.sort](a, b));

  const total = all.length;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(filters.page, pageCount);
  const deals = all.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <DealsClient
      deals={deals}
      platforms={platforms}
      baseCurrency={user.baseCurrency}
      filters={{ ...filters, page }}
      total={total}
      pageCount={pageCount}
    />
  );
}
