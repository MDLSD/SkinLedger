import type { Metadata } from "next";
import { ArrowDown, ArrowRight, ArrowUp, Star } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { Link, redirect } from "@/i18n/navigation";
import { toLocale } from "@/i18n/routing";
import { withDynamicKeys } from "@/i18n/dynamic";
import { prisma } from "@/lib/prisma";
import { SourceIcon } from "@/components/source-icon";
import { SpreadsFilterBar } from "@/components/spreads-filterbar";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatMoney, formatPct } from "@/lib/deal-math";
import { fxFactor } from "@/lib/currency";
import { getRates } from "@/lib/rates";
import { displayCurrency } from "@/lib/display-currency";
import {
  buildSpreadQuery,
  parseSpreadFilters,
  type SpreadFilters,
  type SpreadSort,
} from "@/lib/prices/spreads";
import { loadSpreads } from "@/lib/prices/spreads-load";

type Params = Promise<{ locale: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: toLocale(locale), namespace: "spreads" });
  return { title: t("metaTitle") };
}

export default async function SpreadsPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { locale: rawLocale } = await params;
  const locale = toLocale(rawLocale);
  setRequestLocale(locale);
  const t = await getTranslations("spreads");
  const tc = withDynamicKeys(await getTranslations("catalog"));

  const session = await auth();
  if (!session?.user?.id) redirect({ href: "/login", locale });
  const userId = session.user.id;

  const filters = parseSpreadFilters(await searchParams);
  const [result, user, ratesResult] = await Promise.all([
    loadSpreads(filters, userId),
    prisma.user.findUnique({ where: { id: userId }, select: { baseCurrency: true } }),
    getRates(),
  ]);

  const cur = await displayCurrency(user?.baseCurrency);
  const fx = fxFactor("USD", cur, ratesResult.rates);
  const money = (usd: number) =>
    fx == null ? formatMoney(usd, "USD", locale) : formatMoney(usd * fx, cur, locale);
  const signed = (usd: number) =>
    fx == null
      ? formatMoney(usd, "USD", locale, true)
      : formatMoney(usd * fx, cur, locale, true);

  const sortHref = (key: SpreadSort) => {
    const dir = filters.sort === key && filters.dir === "desc" ? "asc" : "desc";
    return buildSpreadQuery(filters, { sort: key, dir, page: 1 });
  };

  const pageHref = (page: number) => buildSpreadQuery(filters, { page });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <SpreadsFilterBar filters={filters} />

      <p className="text-sm text-muted-foreground">
        <span className="font-semibold text-primary">
          [{result.total.toLocaleString(locale)}]
        </span>{" "}
        {t("found")}
        {result.total !== result.matched &&
          ` ${t("ofTraded", { count: result.matched.toLocaleString(locale) })}`}
      </p>

      {result.rows.length === 0 ? (
        <p className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
          {t("empty")}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <Table className="[&_td]:px-4 [&_td]:py-3 [&_th]:h-12 [&_th]:px-4 [&_th]:text-xs [&_th]:font-normal [&_th]:text-muted-foreground">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>{t("item")}</TableHead>
                <TableHead>
                  <SortLink k="buy" label={t("buyOn")} filters={filters} href={sortHref("buy")} />
                </TableHead>
                <TableHead>{t("sellOn")}</TableHead>
                <TableHead>
                  <span className="flex items-center gap-2">
                    <SortLink
                      k="profitPct"
                      label={t("margin")}
                      filters={filters}
                      href={sortHref("profitPct")}
                    />
                    <SortLink
                      k="profit"
                      label={t("profit")}
                      filters={filters}
                      href={sortHref("profit")}
                    />
                  </span>
                </TableHead>
                <TableHead>
                  <SortLink k="liq" label={t("sales30d")} filters={filters} href={sortHref("liq")} />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.rows.map((r) => {
                const pos = r.profit > 0;
                const top = r.titleTop || (r.kind ? tc(`kind.${r.kind}`) : "");
                return (
                  <TableRow key={r.marketHashName} className="border-border/60">
                    <TableCell className="max-w-[420px]">
                      <span className="flex items-center gap-3">
                        {r.slug ? (
                          <Link href={`/skins/${r.slug}`} className="shrink-0">
                            <Thumb image={r.image} />
                          </Link>
                        ) : (
                          <Thumb image={r.image} />
                        )}
                        <span className="min-w-0">
                          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            {r.favorite && (
                              <Star className="size-3 text-[#f0a020]" fill="currentColor" />
                            )}
                            <span className="truncate">{top}</span>
                          </span>
                          <span className="block truncate text-sm">{r.titleMain}</span>
                        </span>
                      </span>
                    </TableCell>

                    <TableCell>
                      <span className="flex items-center gap-2">
                        <SourceIcon
                          slug={r.buySlug}
                          title={r.buyTitle}
                          className="size-5 text-[9px]"
                        />
                        <span className="min-w-0">
                          <span className="block truncate text-xs text-muted-foreground">
                            {r.buyTitle}
                          </span>
                          <span className="block text-sm font-medium tabular-nums">
                            {money(r.buyPrice)}
                          </span>
                        </span>
                      </span>
                    </TableCell>

                    <TableCell>
                      <span className="flex items-center gap-2">
                        <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" />
                        <SourceIcon
                          slug={r.sellSlug}
                          title={r.sellTitle}
                          className="size-5 text-[9px]"
                        />
                        <span className="min-w-0">
                          <span className="block truncate text-xs text-muted-foreground">
                            {r.sellTitle}
                          </span>
                          <span className="block text-sm font-medium tabular-nums">
                            {money(r.sellPrice)}
                          </span>
                        </span>
                      </span>
                    </TableCell>

                    <TableCell
                      className={`tabular-nums ${pos ? "text-primary" : "text-destructive"}`}
                    >
                      <span className="block text-sm font-semibold">
                        {formatPct(r.profitPct, locale)}
                      </span>
                      <span className="block text-xs">{signed(r.profit)}</span>
                    </TableCell>

                    <TableCell className="text-sm tabular-nums text-muted-foreground">
                      {r.liquidity != null ? r.liquidity.toLocaleString(locale) : "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {result.pageCount > 1 && (
        <div className="flex items-center justify-center gap-4">
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href={pageHref(result.page - 1)} scroll={false} />}
            aria-disabled={result.page <= 1}
            className={result.page <= 1 ? "pointer-events-none opacity-50" : ""}
          >
            {t("prev")}
          </Button>
          <span className="text-sm text-muted-foreground">
            {result.page} / {result.pageCount}
          </span>
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href={pageHref(result.page + 1)} scroll={false} />}
            aria-disabled={result.page >= result.pageCount}
            className={result.page >= result.pageCount ? "pointer-events-none opacity-50" : ""}
          >
            {t("next")}
          </Button>
        </div>
      )}
    </div>
  );
}

function Thumb({ image }: { image: string | null }) {
  const box = "block h-10 w-14 shrink-0 rounded bg-muted/40 object-contain";
  return image ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={image} alt="" className={box} loading="lazy" />
  ) : (
    <span className={box} />
  );
}

function SortLink({
  k,
  label,
  filters,
  href,
}: {
  k: SpreadSort;
  label: string;
  filters: SpreadFilters;
  href: string;
}) {
  const active = filters.sort === k;
  return (
    <Link
      href={href}
      scroll={false}
      className={`inline-flex items-center gap-1 whitespace-nowrap hover:text-foreground ${
        active ? "text-foreground" : ""
      }`}
    >
      {label}
      {active &&
        (filters.dir === "desc" ? (
          <ArrowDown className="size-3" />
        ) : (
          <ArrowUp className="size-3" />
        ))}
    </Link>
  );
}
