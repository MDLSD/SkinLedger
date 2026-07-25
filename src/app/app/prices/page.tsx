import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowDown, ArrowUp } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PricesToolbar } from "@/components/prices-toolbar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { formatMoney, formatPct } from "@/lib/deal-math";
import {
  buildPriceQuery,
  parsePriceFilters,
  PRICE_TYPES,
  SORT_COLUMNS,
  type SortKey,
} from "@/lib/prices/compare";
import { loadComparison } from "@/lib/prices/compare-load";

export const metadata: Metadata = { title: "Сравнение цен — SkinLedger" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

// Заголовки, по которым сортируем: клик по активному переключает направление,
// по остальным — ставит сортировку по убыванию.
const NUMERIC: Record<SortKey, boolean> = {
  name: false,
  buy: true,
  sell: true,
  profit: true,
  profitPct: true,
  liq: true,
};

export default async function PricesPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const sources = await prisma.marketSource.findMany({
    where: { isActive: true },
    orderBy: { title: "asc" },
    select: { slug: true, title: true, buyFeePct: true, sellFeePct: true, withdrawFeePct: true },
  });
  const slugs = sources.map((s) => s.slug);
  const filters = parsePriceFilters(await searchParams, slugs);

  const hasData = sources.length > 0;
  const result = hasData
    ? await loadComparison(filters, sources)
    : { rows: [], total: 0, page: 1, pageCount: 1, matched: 0 };

  const buyTitle = sources.find((s) => s.slug === filters.buy)?.title ?? filters.buy;
  const sellTitle = sources.find((s) => s.slug === filters.sell)?.title ?? filters.sell;
  const priceLabel = PRICE_TYPES.find((t) => t.value === filters.type)?.label ?? "";

  const sortHref = (key: SortKey) => {
    const dir = filters.sort === key && filters.dir === "desc" ? "asc" : "desc";
    return buildPriceQuery(filters, { sort: key, dir, page: 1 });
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Сравнение цен</h1>
        <p className="text-sm text-muted-foreground">
          Купить на <span className="text-foreground">{buyTitle}</span> → продать на{" "}
          <span className="text-foreground">{sellTitle}</span>. Прибыль с учётом комиссий площадок
          ({priceLabel.toLowerCase()} цена, в долларах).
        </p>
      </div>

      <PricesToolbar filters={filters} sources={sources} />

      {!hasData ? (
        <p className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
          Цены ещё не загружены. Запустите <code className="text-foreground">npm run prices:ingest</code>.
        </p>
      ) : result.matched === 0 ? (
        <p className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
          Нет предметов, торгующихся на обеих площадках одновременно. Попробуйте другую пару.
        </p>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            Найдено связок: <span className="text-foreground">{result.total.toLocaleString("ru-RU")}</span>
            {result.total !== result.matched && ` из ${result.matched.toLocaleString("ru-RU")} общих`} ·
            страница {result.page} из {result.pageCount}
          </p>

          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  {SORT_COLUMNS.map((col) => {
                    const active = filters.sort === col.key;
                    return (
                      <TableHead
                        key={col.key}
                        className={NUMERIC[col.key] ? "text-right" : undefined}
                      >
                        <Link
                          href={sortHref(col.key)}
                          scroll={false}
                          className={`inline-flex items-center gap-1 hover:text-foreground ${
                            active ? "text-foreground" : ""
                          } ${NUMERIC[col.key] ? "flex-row-reverse" : ""}`}
                        >
                          {col.label}
                          {active &&
                            (filters.dir === "desc" ? (
                              <ArrowDown className="size-3.5" />
                            ) : (
                              <ArrowUp className="size-3.5" />
                            ))}
                        </Link>
                      </TableHead>
                    );
                  })}
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.rows.map((r) => {
                  const pos = r.profit > 0;
                  return (
                    <TableRow key={r.marketHashName}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {r.image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={r.image}
                              alt=""
                              className="h-8 w-8 shrink-0 rounded bg-muted/40 object-contain"
                              loading="lazy"
                            />
                          ) : (
                            <div className="h-8 w-8 shrink-0 rounded bg-muted/40" />
                          )}
                          <span className="text-sm">{r.marketHashName}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(r.buyPrice, "USD")}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(r.sellPrice, "USD")}
                      </TableCell>
                      <TableCell
                        className={`text-right tabular-nums ${pos ? "text-primary" : "text-destructive"}`}
                      >
                        {formatMoney(r.profit, "USD", true)}
                      </TableCell>
                      <TableCell
                        className={`text-right font-medium tabular-nums ${pos ? "text-primary" : "text-destructive"}`}
                      >
                        {formatPct(r.profitPct)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {r.liquidity != null ? r.liquidity.toLocaleString("ru-RU") : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {result.pageCount > 1 && (
            <div className="flex items-center justify-center gap-4">
              <Button
                variant="outline"
                size="sm"
                nativeButton={false}
                render={<Link href={buildPriceQuery(filters, { page: result.page - 1 })} scroll={false} />}
                aria-disabled={result.page <= 1}
                className={result.page <= 1 ? "pointer-events-none opacity-50" : ""}
              >
                Назад
              </Button>
              <span className="text-sm text-muted-foreground">
                {result.page} / {result.pageCount}
              </span>
              <Button
                variant="outline"
                size="sm"
                nativeButton={false}
                render={<Link href={buildPriceQuery(filters, { page: result.page + 1 })} scroll={false} />}
                aria-disabled={result.page >= result.pageCount}
                className={result.page >= result.pageCount ? "pointer-events-none opacity-50" : ""}
              >
                Вперёд
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
