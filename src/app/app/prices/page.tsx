import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowDown,
  ArrowLeftRight,
  ArrowUp,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PricesSidebar } from "@/components/prices-sidebar";
import { PricesFilterBar } from "@/components/prices-filterbar";
import { SourceIcon } from "@/components/source-icon";
import { PricesSearch } from "@/components/prices-search";
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
import { CURRENCY_SYMBOL, fxFactor } from "@/lib/currency";
import { getRates } from "@/lib/rates";
import {
  buildPriceQuery,
  parsePriceFilters,
  type PriceFilters,
  type SortKey,
} from "@/lib/prices/compare";
import { loadComparison } from "@/lib/prices/compare-load";

export const metadata: Metadata = { title: "Таблица — SkinLedger" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

// Сортируемый заголовок: клик по активному переключает направление,
// по остальным — ставит сортировку по убыванию.
function SortLink({
  k,
  label,
  filters,
  icon,
}: {
  k: SortKey;
  label: string;
  filters: PriceFilters;
  icon?: React.ReactNode;
}) {
  const active = filters.sort === k;
  const dir = active && filters.dir === "desc" ? "asc" : "desc";
  return (
    <Link
      href={buildPriceQuery(filters, { sort: k, dir, page: 1 })}
      scroll={false}
      className={`inline-flex items-center gap-1.5 whitespace-nowrap hover:text-foreground ${
        active ? "text-foreground" : ""
      }`}
    >
      {icon}
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

// Цена как в референсе: сверху мелко USD, снизу крупно в валюте пользователя,
// справа — число предложений на площадке. Базовая валюта USD — одна строка.
function PriceCell({
  usd,
  cur,
  factor,
  offers,
}: {
  usd: number;
  cur: string;
  factor: number | null;
  offers: number | null;
}) {
  const single = factor == null || cur === "USD";
  return (
    <div className="flex items-end justify-between gap-3">
      <div className="tabular-nums">
        {!single && (
          <div className="text-xs text-muted-foreground">{formatMoney(usd, "USD")}</div>
        )}
        <div className="text-sm font-medium">
          {single ? formatMoney(usd, "USD") : formatMoney(usd * factor, cur)}
        </div>
      </div>
      {offers != null && (
        <span className="text-xs tabular-nums text-muted-foreground">
          {offers.toLocaleString("ru-RU")}
        </span>
      )}
    </div>
  );
}

// «3 мин», «6 ч», «2 д» — свежесть котировки.
function ago(d: Date, now: number): string {
  const min = Math.max(0, Math.round((now - d.getTime()) / 60000));
  if (min < 1) return "только что";
  if (min < 60) return `${min} мин`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} ч`;
  return `${Math.round(h / 24)} д`;
}

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
    : { rows: [], total: 0, page: 1, pageCount: 1, matched: 0, now: 0 };

  // Вторая строка цены — в валюте пользователя (курс из парсера).
  const [user, ratesResult] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { baseCurrency: true },
    }),
    getRates(),
  ]);
  const cur = user?.baseCurrency ?? "RUB";
  const fx = fxFactor("USD", cur, ratesResult.rates);

  const buyTitle = sources.find((s) => s.slug === filters.buy)?.title ?? filters.buy;
  const sellTitle = sources.find((s) => s.slug === filters.sell)?.title ?? filters.sell;

  return (
    // Страница во всю ширину экрана: панель настроек прижата к левому краю,
    // таблице достаётся всё остальное. calc(50% − 50vw) «отменяет» центровку
    // контейнера приложения (mx-auto max-w-[1600px] + паддинги).
    <div className="flex flex-col gap-4 lg:mx-[calc(50%-50vw)] lg:flex-row lg:items-start lg:gap-6">
      {/* В клиент отдаём только простые поля: Decimal-комиссии не сериализуются. */}
      <PricesSidebar
        filters={filters}
        sources={sources.map(({ slug, title }) => ({ slug, title }))}
      />

      <div className="min-w-0 flex-1 space-y-4 lg:pr-8">
        <div>
          <h1 className="text-xl font-semibold">Таблица</h1>
          <p className="text-sm text-muted-foreground">
            Купить на <span className="text-foreground">{buyTitle}</span> → продать на{" "}
            <span className="text-foreground">{sellTitle}</span>. Прибыль с учётом комиссий площадок,
            в долларах.
          </p>
        </div>

        <PricesFilterBar filters={filters} />

        {!hasData ? (
          <p className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
            Цены ещё не загружены. Запустите{" "}
            <code className="text-foreground">npm run prices:ingest</code>.
          </p>
        ) : result.matched === 0 ? (
          <p className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
            Нет предметов, торгующихся на обеих площадках одновременно. Попробуйте другую пару.
          </p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-primary">
                [{result.total.toLocaleString("ru-RU")}]
              </span>{" "}
              Предметов найдено
              {result.total !== result.matched &&
                ` из ${result.matched.toLocaleString("ru-RU")} общих`}
            </p>

            <div className="overflow-x-auto rounded-lg border border-border bg-card">
            {/* Раскладка строк — по референсу csmarketcap/Pulse: предмет двумя
                строками, цена в USD над ценой в валюте пользователя, справа от
                неё число предложений, прибыль % над абсолютной, свежесть
                котировки и продажи за 30 дней по обеим площадкам. */}
            <Table className="[&_td]:px-4 [&_td]:py-3 [&_th]:h-12 [&_th]:px-4 [&_th]:text-xs [&_th]:font-normal [&_th]:text-muted-foreground">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="flex h-12 items-center gap-3">
                    <PricesSearch filters={filters} />
                    <SortLink k="name" label="Название" filters={filters} />
                  </TableHead>
                  <TableHead>
                    <SortLink
                      k="buy"
                      label={buyTitle}
                      filters={filters}
                      icon={<SourceIcon slug={filters.buy} title={buyTitle} className="size-4 text-[8px]" />}
                    />
                  </TableHead>
                  <TableHead>
                    <SortLink
                      k="sell"
                      label={sellTitle}
                      filters={filters}
                      icon={<SourceIcon slug={filters.sell} title={sellTitle} className="size-4 text-[8px]" />}
                    />
                  </TableHead>
                  <TableHead>
                    <span className="flex items-center gap-2">
                      <SortLink k="profitPct" label="Прибыль" filters={filters} />
                      <SortLink k="profit" label={cur === "USD" ? "$" : CURRENCY_SYMBOL[cur] ?? cur} filters={filters} />
                    </span>
                  </TableHead>
                  <TableHead>Обновлено</TableHead>
                  <TableHead>
                    <SortLink k="liq" label="Продажи [30д]" filters={filters} />
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.rows.map((r) => {
                  const pos = r.profit > 0;
                  const tone = pos ? "text-primary" : "text-destructive";
                  return (
                    <TableRow key={r.marketHashName} className="border-border/60">
                      {/* Предмет */}
                      <TableCell className="max-w-[420px]">
                        <div className="flex items-center gap-3">
                          {r.image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={r.image}
                              alt=""
                              className="h-10 w-14 shrink-0 rounded bg-muted/40 object-contain"
                              loading="lazy"
                            />
                          ) : (
                            <div className="h-10 w-14 shrink-0 rounded bg-muted/40" />
                          )}
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <span className="truncate">{r.titleTop}</span>
                              {r.stattrak && (
                                <span className="rounded bg-[#cf6a32]/20 px-1 text-[10px] font-medium text-[#cf6a32]">
                                  ST
                                </span>
                              )}
                              {r.souvenir && (
                                <span className="rounded bg-[#ffd700]/20 px-1 text-[10px] font-medium text-[#e0b400]">
                                  SV
                                </span>
                              )}
                            </div>
                            <div className="truncate text-sm">{r.titleMain}</div>
                          </div>
                        </div>
                      </TableCell>

                      {/* Цена покупки */}
                      <TableCell>
                        <PriceCell usd={r.buyPrice} cur={cur} factor={fx} offers={r.buyOffers} />
                      </TableCell>

                      {/* Цена продажи */}
                      <TableCell>
                        <PriceCell usd={r.sellPrice} cur={cur} factor={fx} offers={r.sellOffers} />
                      </TableCell>

                      {/* Прибыль: маржа сверху, абсолютная снизу */}
                      <TableCell className={`tabular-nums ${tone}`}>
                        <div className="flex items-center gap-1.5 text-xs">
                          {pos ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
                          {formatPct(r.profitPct)}
                        </div>
                        <div className="flex items-center gap-1.5 text-sm font-medium">
                          <ArrowLeftRight className="size-3.5 opacity-70" />
                          {fx == null
                            ? formatMoney(r.profit, "USD", true)
                            : formatMoney(r.profit * fx, cur, true)}
                        </div>
                      </TableCell>

                      {/* Свежесть котировок по обеим площадкам */}
                      <TableCell className="text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <SourceIcon slug={filters.buy} title={buyTitle} className="size-3.5 text-[7px]" />
                          {ago(r.buyFetchedAt, result.now)}
                        </div>
                        <div className="mt-1 flex items-center gap-1.5">
                          <SourceIcon slug={filters.sell} title={sellTitle} className="size-3.5 text-[7px]" />
                          {ago(r.sellFetchedAt, result.now)}
                        </div>
                      </TableCell>

                      {/* Продажи за 30 дней на обеих площадках */}
                      <TableCell>
                        <div className="flex items-center gap-4 text-xs tabular-nums">
                          <span className="flex flex-col items-center gap-1">
                            <SourceIcon slug={filters.buy} title={buyTitle} className="size-4 text-[8px]" />
                            <span className="text-muted-foreground">
                              {r.buySales != null ? r.buySales.toLocaleString("ru-RU") : "—"}
                            </span>
                          </span>
                          <span className="flex flex-col items-center gap-1">
                            <SourceIcon slug={filters.sell} title={sellTitle} className="size-4 text-[8px]" />
                            <span className="text-muted-foreground">
                              {r.liquidity != null ? r.liquidity.toLocaleString("ru-RU") : "—"}
                            </span>
                          </span>
                        </div>
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
    </div>
  );
}
