import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { redirect } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import { formatMoney, formatPct } from "@/lib/deal-math";
import { dealFxRate } from "@/lib/currency";
import { getRates } from "@/lib/rates";
import { parseDealFilters, periodRange } from "@/lib/deal-list";
import { computeDashboard, type DashDeal, type DealBrief } from "@/lib/dashboard";
import { loadHoldingMarket } from "@/lib/prices/holding-market";
import { DashboardCharts } from "@/components/dashboard-charts";
import { DashboardPeriod } from "@/components/dashboard-period";
import { Hint } from "@/components/hint";
import { RatesNotice } from "@/components/rates-notice";
import { loadAllByCursor } from "@/lib/db-batch";
import { toLocale } from "@/i18n/routing";

type Params = Promise<{ locale: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

// Только поля, которые реально участвуют в агрегатах.
const DASH_SELECT = {
  id: true,
  itemName: true,
  itemQuality: true,
  status: true,
  buyDate: true,
  sellDate: true,
  quantity: true,
  buyPrice: true,
  buyFeePct: true,
  buyCurrency: true,
  buyFxRate: true,
  sellPrice: true,
  sellFeePct: true,
  sellCurrency: true,
  sellFxRate: true,
  sellPlatform: { select: { name: true } },
} as const;

export default async function DashboardPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { locale: rawLocale } = await params;
  const locale = toLocale(rawLocale);
  setRequestLocale(locale);
  const t = await getTranslations("dashboard");

  const session = await auth();
  if (!session?.user?.id) redirect({ href: "/login", locale });
  const userId = session.user.id;
  const f = parseDealFilters(await searchParams);
  const range = periodRange(f);

  const [user, { rows: dealRows, truncated }, { rates, source: ratesSource }] =
    await Promise.all([
      prisma.user.findUniqueOrThrow({
        where: { id: userId },
        // Только нужное поле: без select сюда приезжал и passwordHash.
        select: { baseCurrency: true, monthlyGoal: true },
      }),
      // Агрегаты должны покрывать все сделки: `take: 5000` без `orderBy` считал
      // прибыль по произвольному подмножеству и никак об этом не сообщал.
      loadAllByCursor((cursor, take) =>
        prisma.deal.findMany({
          where: { userId },
          select: DASH_SELECT,
          orderBy: { id: "asc" },
          take,
          ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        }),
      ),
      getRates(),
    ]);
  const cur = user.baseCurrency;

  // Переоценка холда по рынку (ТЗ 6): считается отдельно от агрегатов,
  // потому что источник данных другой — котировки, а не сами сделки.
  const holdMarket = await loadHoldingMarket(userId, cur, rates);

  let unresolvedFx = 0;
  const deals: DashDeal[] = dealRows.flatMap((d) => {
    // Закрытая сделка считается по зафиксированным курсам, холд — по текущим.
    const closed = d.status !== "holding";
    const buyFxRate = dealFxRate(closed, Number(d.buyFxRate), d.buyCurrency, cur, rates);
    const sellFxRate = dealFxRate(
      closed,
      d.sellFxRate != null ? Number(d.sellFxRate) : null,
      d.sellCurrency,
      cur,
      rates,
    );
    // Без курса сделка не участвует в агрегатах: 1:1 исказил бы их молча.
    if (buyFxRate == null || (d.sellCurrency != null && sellFxRate == null)) {
      unresolvedFx++;
      return [];
    }
    return [
      {
        id: d.id,
        itemName: d.itemName,
        itemQuality: d.itemQuality,
        status: d.status,
        buyDate: d.buyDate,
        sellDate: d.sellDate,
        quantity: d.quantity,
        buyPrice: Number(d.buyPrice),
        buyFeePct: Number(d.buyFeePct),
        buyFxRate,
        sellPrice: d.sellPrice != null ? Number(d.sellPrice) : null,
        sellFeePct: d.sellFeePct != null ? Number(d.sellFeePct) : null,
        sellFxRate,
        sellPlatformName: d.sellPlatform?.name ?? null,
      },
    ];
  });

  const dash = computeDashboard(deals, range);
  const c = dash.cards;
  const goal = user.monthlyGoal == null ? null : Number(user.monthlyGoal);
  const goalPct =
    goal && goal > 0 ? Math.max(0, Math.min(100, (dash.thisMonthProfit / goal) * 100)) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <DashboardPeriod period={f.period} from={f.from} to={f.to} />
      </div>

      <RatesNotice
        source={ratesSource}
        unresolvedFx={unresolvedFx}
        truncated={truncated}
        excludedLabel="excluded"
      />

      {goal && (
        <div className="rounded-lg border bg-card p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="flex items-center gap-1 text-sm font-medium">
              {t("goal")}
              <Hint text={t("goalHint")} />
            </h3>
            <div className="text-sm">
              <span className={`font-semibold ${dash.thisMonthProfit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {formatMoney(dash.thisMonthProfit, cur, locale, true)}
              </span>
              <span className="text-muted-foreground"> / {formatMoney(goal, cur, locale)}</span>
              <span className="ml-2 text-muted-foreground">{Math.round(goalPct ?? 0)}%</span>
            </div>
          </div>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${goalPct ?? 0}%` }}
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat label={t("netProfit")} value={formatMoney(c.netProfit, cur, locale, true)} tone={c.netProfit >= 0 ? "pos" : "neg"} hint={t("netProfitHint")} />
        <Stat label={t("turnover")} value={formatMoney(c.turnover, cur, locale)} hint={t("turnoverHint")} />
        <Stat label={t("roi")} value={c.roiPct == null ? "—" : formatPct(c.roiPct, locale)} tone={c.roiPct == null ? undefined : c.roiPct >= 0 ? "pos" : "neg"} hint={t("roiHint")} />
        <Stat label={t("avgMargin")} value={c.avgMargin == null ? "—" : formatPct(c.avgMargin, locale)} tone={c.avgMargin == null ? undefined : c.avgMargin >= 0 ? "pos" : "neg"} hint={t("avgMarginHint")} />
        <Stat label={t("avgProfit")} value={c.avgProfitPerDeal == null ? "—" : formatMoney(c.avgProfitPerDeal, cur, locale, true)} tone={c.avgProfitPerDeal == null ? undefined : c.avgProfitPerDeal >= 0 ? "pos" : "neg"} sub={c.closedCount ? t("closedCount", { count: c.closedCount }) : undefined} hint={t("avgProfitHint")} />
        <Stat label={t("bestTrade")} value={c.bestTrade == null ? "—" : formatMoney(c.bestTrade, cur, locale, true)} tone={c.bestTrade == null ? undefined : c.bestTrade >= 0 ? "pos" : "neg"} hint={t("bestTradeHint")} />
        <Stat label={t("avgHold")} value={c.avgHoldDays == null ? "—" : t("daysShort", { count: c.avgHoldDays })} hint={t("avgHoldHint")} />
        <Stat label={t("frozen")} value={formatMoney(c.frozenInHolding, cur, locale)} hint={t("frozenHint")} />
        <Stat
          label={t("holdMarket")}
          value={holdMarket.priced ? formatMoney(holdMarket.marketValue, cur, locale) : "—"}
          sub={
            holdMarket.positions
              ? t("holdMarketCoverage", { priced: holdMarket.priced, total: holdMarket.positions })
              : undefined
          }
          hint={t("holdMarketHint")}
        />
        <Stat
          label={t("holdUnrealized")}
          value={
            holdMarket.priced
              ? formatMoney(holdMarket.profit, cur, locale, true)
              : "—"
          }
          tone={holdMarket.priced ? (holdMarket.profit >= 0 ? "pos" : "neg") : undefined}
          sub={
            holdMarket.profitPct == null
              ? undefined
              : formatPct(holdMarket.profitPct, locale)
          }
          hint={t("holdUnrealizedHint")}
        />
        <Stat label={t("holdingCount")} value={String(c.holdingCount)} sub={c.holdingCount ? t("tradable", { count: c.tradableCount }) : undefined} hint={t("holdingCountHint")} />
        <Stat label={t("deadCapital")} value={formatMoney(dash.deadCapital.amount, cur, locale)} tone={dash.deadCapital.amount > 0 ? "neg" : undefined} sub={dash.deadCapital.count ? t("deadCapitalCount", { count: dash.deadCapital.count }) : t("deadCapitalNone")} hint={t("deadCapitalHint")} />
      </div>

      <DashboardCharts
        monthly={dash.monthly}
        monthlyRoi={dash.monthlyRoi}
        cumulative={dash.cumulative}
        marginByHold={dash.marginByHold}
        currency={cur}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <TopList title={t("topProfit")} deals={dash.topProfit} currency={cur} locale={locale} tone="pos" hint={t("topProfitHint")} emptyLabel={t("noDataPeriod")} />
        <TopList title={t("topLoss")} deals={dash.topLoss} currency={cur} locale={locale} tone="neg" hint={t("topLossHint")} emptyLabel={t("noDataPeriod")} />
      </div>

      <div className="rounded-lg border bg-card p-4">
        <h3 className="mb-3 flex items-center gap-1 text-sm font-medium">
          {t("byPlatform")}
          <Hint text={t("byPlatformHint")} />
        </h3>
        {dash.platforms.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noClosedDeals")}</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="pb-2 font-normal">{t("platform")}</th>
                <th className="pb-2 text-right font-normal">{t("dealsCol")}</th>
                <th className="pb-2 text-right font-normal">{t("avgMarginCol")}</th>
                <th className="pb-2 text-right font-normal">{t("profitCol")}</th>
              </tr>
            </thead>
            <tbody>
              {dash.platforms.map((p) => (
                <tr key={p.name} className="border-t">
                  <td className="py-1.5">{p.name}</td>
                  <td className="py-1.5 text-right">{p.count}</td>
                  <td className={`py-1.5 text-right ${p.margin == null ? "text-muted-foreground" : p.margin >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {p.margin == null ? "—" : formatPct(p.margin, locale)}
                  </td>
                  <td className={`py-1.5 text-right ${p.profit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {formatMoney(p.profit, cur, locale, true)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
  sub,
  hint,
}: {
  label: string;
  value: string;
  tone?: "pos" | "neg";
  sub?: string;
  hint?: string;
}) {
  const color = tone === "pos" ? "text-emerald-400" : tone === "neg" ? "text-red-400" : "";
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <span>{label}</span>
        {hint && <Hint text={hint} />}
      </div>
      <div className={`mt-1 text-xl font-semibold ${color}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function TopList({
  title,
  deals,
  currency,
  locale,
  tone,
  hint,
  emptyLabel,
}: {
  title: string;
  deals: DealBrief[];
  currency: string;
  locale: string;
  tone: "pos" | "neg";
  hint?: string;
  emptyLabel: string;
}) {
  const color = tone === "pos" ? "text-emerald-400" : "text-red-400";
  return (
    <div className="rounded-lg border bg-card p-4">
      <h3 className="mb-3 flex items-center gap-1 text-sm font-medium">
        {title}
        {hint && <Hint text={hint} />}
      </h3>
      {deals.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <ul className="space-y-2">
          {deals.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-3 text-sm">
              <span className="min-w-0 truncate">
                {d.itemName}
                {d.itemQuality && (
                  <span className="text-muted-foreground"> · {d.itemQuality}</span>
                )}
              </span>
              <span className={`whitespace-nowrap font-medium ${color}`}>
                {formatMoney(d.profit, currency, locale, true)}
                {d.margin != null && (
                  <span className="ml-1 text-xs text-muted-foreground">
                    {formatPct(d.margin, locale)}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
