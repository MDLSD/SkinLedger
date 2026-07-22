import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { DealsClient } from "@/components/deals-client";
import { RatesNotice } from "@/components/rates-notice";
import { loadUserDeals } from "@/lib/deal-query";
import { PAGE_SIZE, parseDealFilters } from "@/lib/deal-list";
import type { PlatformDTO } from "@/lib/types";

export const metadata: Metadata = { title: "Сделки — SkinLedger" };

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

  const [{ deals: all, base, rates, ratesSource, unresolvedFx, truncated }, platformRows, totalAll] =
    await Promise.all([
      loadUserDeals(userId, filters),
      prisma.platform.findMany({
        where: { OR: [{ isCustom: false }, { userId }] },
        orderBy: [{ isCustom: "asc" }, { name: "asc" }],
      }),
      prisma.deal.count({ where: { userId } }),
    ]);

  const platforms: PlatformDTO[] = platformRows.map((p) => ({
    id: p.id,
    name: p.name,
    defaultBuyFeePct: Number(p.defaultBuyFeePct),
    defaultSellFeePct: Number(p.defaultSellFeePct),
    isCustom: p.isCustom,
  }));

  const total = all.length;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(filters.page, pageCount);
  const deals = all.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-4">
      <RatesNotice
        source={ratesSource}
        unresolvedFx={unresolvedFx}
        truncated={truncated}
        excludedLabel="сделок скрыто"
      />
      <DealsClient
        deals={deals}
        platforms={platforms}
        baseCurrency={base}
        rates={rates}
        filters={{ ...filters, page }}
        total={total}
        totalAll={totalAll}
        pageCount={pageCount}
      />
    </div>
  );
}
