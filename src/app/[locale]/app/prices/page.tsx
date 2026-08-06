import type { Metadata } from "next";
import { ArrowDown, ArrowUp } from "lucide-react";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { Link, redirect } from "@/i18n/navigation";
import { toLocale } from "@/i18n/routing";
import { prisma } from "@/lib/prisma";
import { PricesSidebar } from "@/components/prices-sidebar";
import { PricesFilterBar } from "@/components/prices-filterbar";
import { SourceIcon } from "@/components/source-icon";
import { PricesSearch } from "@/components/prices-search";
import { PricesRows } from "@/components/prices-rows";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CURRENCY_SYMBOL, fxFactor } from "@/lib/currency";
import { getRates } from "@/lib/rates";
import {
  buildPriceQuery,
  parsePriceFilters,
  type PriceFilters,
  type SortKey,
} from "@/lib/prices/compare";
import { loadComparison } from "@/lib/prices/compare-load";
import { allowedSources, effectivePlan, limitsFor } from "@/lib/plan";
import { PlanBanner } from "@/components/plan-banner";

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
  return { title: t("prices") };
}

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

export default async function PricesPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { locale: rawLocale } = await params;
  const locale = toLocale(rawLocale);
  setRequestLocale(locale);
  const t = await getTranslations("prices");
  const format = await getFormatter();

  const session = await auth();
  if (!session?.user?.id) redirect({ href: "/login", locale });

  const planUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { plan: true, planUntil: true },
  });
  const plan = effectivePlan(planUser);
  const limits = limitsFor(planUser);

  const allSources = await prisma.marketSource.findMany({
    where: { isActive: true },
    orderBy: { title: "asc" },
    select: { slug: true, title: true, buyFeePct: true, sellFeePct: true, withdrawFeePct: true },
  });
  // На бесплатном тарифе доступна часть площадок (ТЗ 6). Из выборки данных
  // остальные выпадают, но в списке панели остаются — с меткой тарифа.
  const sources = allowedSources(allSources, limits);
  const slugs = sources.map((s) => s.slug);
  // Доступные — наверх списка: платные внизу не мешают выбирать из своих.
  const allowed = new Set(slugs);
  const sidebarSources = allSources
    .map(({ slug, title }) => ({ slug, title, locked: !allowed.has(slug) }))
    .sort((a, b) => Number(a.locked) - Number(b.locked));
  const filters = parsePriceFilters(await searchParams, slugs);

  const hasData = sources.length > 0;
  const result = hasData
    ? await loadComparison(filters, sources, session.user.id, limits.maxItemPrice)
    : { rows: [], total: 0, page: 1, pageCount: 1, matched: 0, now: 0 };

  // Вторая строка цены — в валюте пользователя (курс из парсера).
  const [user, ratesResult, profiles] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { baseCurrency: true },
    }),
    getRates(),
    prisma.priceProfile.findMany({
      where: { userId: session.user.id },
      orderBy: { name: "asc" },
      select: { id: true, name: true, query: true },
    }),
  ]);
  const cur = user?.baseCurrency ?? "RUB";
  const fx = fxFactor("USD", cur, ratesResult.rates);

  // Счётчик скрытых: без него кнопку возврата некуда повесить.
  const hiddenCount = await prisma.watchItem.count({
    where: { userId: session.user.id, kind: "blocked" },
  });

  const buyTitle = sources.find((s) => s.slug === filters.buy)?.title ?? filters.buy;
  const sellTitle = sources.find((s) => s.slug === filters.sell)?.title ?? filters.sell;

  return (
    // Страница во всю ширину экрана: панель настроек прижата к левому краю,
    // таблице достаётся всё остальное. calc(50% − 50vw) «отменяет» центровку
    // контейнера приложения (mx-auto max-w-[1600px] + паддинги).
    <div className="flex flex-col gap-4 lg:mx-[calc(50%-50vw)] lg:flex-row lg:items-start lg:gap-6">
      {/* В клиент отдаём только простые поля: Decimal-комиссии не сериализуются. */}
      <PricesSidebar filters={filters} sources={sidebarSources} profiles={profiles} />

      {/* Колонка во всю высоту экрана: шапка страницы, фильтры и заголовок
          таблицы стоят на месте, прокручивается только тело таблицы. */}
      <div className="flex min-w-0 flex-1 flex-col gap-4 lg:-my-6 lg:h-[calc(100dvh-var(--app-header-h))] lg:py-6 lg:pr-8">
        <div>
          <h1 className="text-xl font-semibold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t.rich("subtitle", {
              buy: buyTitle,
              sell: sellTitle,
              s: (chunks) => <span className="text-foreground">{chunks}</span>,
            })}
          </p>
        </div>

        <PlanBanner plan={plan} limits={limits} lockedSources={allSources.length - sources.length} />
        <PricesFilterBar filters={filters} hidden={hiddenCount} />

        {!hasData ? (
          <p className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
            {t.rich("noPrices", {
              code: (chunks) => <code className="text-foreground">{chunks}</code>,
            })}
          </p>
        ) : result.matched === 0 ? (
          <p className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
            {t("noCommonItems")}
          </p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-primary">
                [{format.number(result.total)}]
              </span>{" "}
              {t("itemsFound")}
              {result.total !== result.matched &&
                ` ${t("ofTotal", { total: format.number(result.matched) })}`}
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
                  <TableHead className="w-20">{t("watchColumn")}</TableHead>
                  {/* display:flex на самой th выключил бы её из табличной
                      раскладки — вместе с липкостью. Флекс во вложенном span. */}
                  <TableHead>
                    <span className="flex items-center gap-3">
                      <PricesSearch filters={filters} />
                      <SortLink k="name" label={t("colName")} filters={filters} />
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
                      <SortLink k="profitPct" label={t("colProfit")} filters={filters} />
                      <SortLink k="profit" label={cur === "USD" ? "$" : CURRENCY_SYMBOL[cur] ?? cur} filters={filters} />
                    </span>
                  </TableHead>
                  <TableHead>{t("colUpdated")}</TableHead>
                  <TableHead>
                    <SortLink k="liq" label={t("colSales30d")} filters={filters} />
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <PricesRows
                  initial={result.rows}
                  query={buildPriceQuery(filters)}
                  hasMore={result.page < result.pageCount}
                  buy={filters.buy}
                  sell={filters.sell}
                  buyTitle={buyTitle}
                  sellTitle={sellTitle}
                  cur={cur}
                  fx={fx}
                  now={result.now}
                  colSpan={7}
                  charts={limits.charts}
                />
              </TableBody>
            </Table>
          </div>

          </>
        )}
      </div>
    </div>
  );
}
