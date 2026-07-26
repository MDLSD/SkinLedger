import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowDown, ArrowUp } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PricesSidebar } from "@/components/prices-sidebar";
import { PricesFilterBar } from "@/components/prices-filterbar";
import { SourceIcon } from "@/components/source-icon";
import { PricesSearch } from "@/components/prices-search";
import { PriceRow } from "@/components/prices-row";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
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

      {/* Колонка во всю высоту экрана: шапка страницы, фильтры и заголовок
          таблицы стоят на месте, прокручивается только тело таблицы. */}
      <div className="flex min-w-0 flex-1 flex-col gap-4 lg:-my-6 lg:h-[calc(100dvh-var(--app-header-h))] lg:py-6 lg:pr-8">
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

            {/* Скроллится сам контейнер таблицы (её первый div), иначе липкая
                строка заголовков цепляется не к тому предку и уезжает. */}
            <div className="min-h-0 flex-1 rounded-lg border border-border bg-card [&>div]:h-full [&>div]:overflow-auto">
            {/* Раскладка строк — по референсу csmarketcap/Pulse: предмет двумя
                строками, цена в USD над ценой в валюте пользователя, справа от
                неё число предложений, прибыль % над абсолютной, свежесть
                котировки и продажи за 30 дней по обеим площадкам. */}
            <Table className="[&_td]:px-4 [&_td]:py-3 [&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:h-12 [&_th]:border-b [&_th]:border-border [&_th]:bg-card [&_th]:px-4 [&_th]:text-xs [&_th]:font-normal [&_th]:text-muted-foreground">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  {/* display:flex на самой th выключил бы её из табличной
                      раскладки — вместе с липкостью. Флекс во вложенном span. */}
                  <TableHead>
                    <span className="flex items-center gap-3">
                      <PricesSearch filters={filters} />
                      <SortLink k="name" label="Название" filters={filters} />
                    </span>
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
                {result.rows.map((r) => (
                  <PriceRow
                    key={r.marketHashName}
                    r={r}
                    buy={filters.buy}
                    sell={filters.sell}
                    buyTitle={buyTitle}
                    sellTitle={sellTitle}
                    cur={cur}
                    fx={fx}
                    now={result.now}
                    colSpan={6}
                  />
                ))}
              </TableBody>
            </Table>
          </div>

          {result.pageCount > 1 && (
            <div className="flex shrink-0 items-center justify-center gap-4">
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
