import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { redirect } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import { DealsClient } from "@/components/deals-client";
import { RatesNotice } from "@/components/rates-notice";
import { loadUserDeals } from "@/lib/deal-query";
import { PAGE_SIZE, parseDealFilters } from "@/lib/deal-list";
import type { PlatformDTO } from "@/lib/types";
import { toLocale } from "@/i18n/routing";

type Params = Promise<{ locale: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = toLocale(rawLocale);
  const t = await getTranslations({ locale, namespace: "meta" });
  return { title: t("deals") };
}

export default async function DealsPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { locale: rawLocale } = await params;
  const locale = toLocale(rawLocale);
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user?.id) redirect({ href: "/login", locale });
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
        excludedLabel="hidden"
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
