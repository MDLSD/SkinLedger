import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { formatMoney, formatPct } from "@/lib/deal-math";
import { dealFxRate } from "@/lib/currency";
import { getRates } from "@/lib/rates";
import { parseDealFilters, periodRange } from "@/lib/deal-list";
import { computeDashboard, type DashDeal, type DealBrief } from "@/lib/dashboard";
import { DashboardCharts } from "@/components/dashboard-charts";
import { DashboardPeriod } from "@/components/dashboard-period";
import { RatesNotice } from "@/components/rates-notice";
import { loadAllByCursor } from "@/lib/db-batch";

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
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
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
        <h1 className="text-2xl font-semibold">Дашборд</h1>
        <DashboardPeriod period={f.period} from={f.from} to={f.to} />
      </div>

      <RatesNotice
        source={ratesSource}
        unresolvedFx={unresolvedFx}
        truncated={truncated}
        excludedLabel="сделок не учтено"
      />

      {goal && (
        <div className="rounded-lg border bg-card p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-sm font-medium">Цель месяца · прибыль</h3>
            <div className="text-sm">
              <span className={`font-semibold ${dash.thisMonthProfit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {formatMoney(dash.thisMonthProfit, cur, true)}
              </span>
              <span className="text-muted-foreground"> / {formatMoney(goal, cur)}</span>
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
        <Stat label="Чистая прибыль" value={formatMoney(c.netProfit, cur, true)} tone={c.netProfit >= 0 ? "pos" : "neg"} />
        <Stat label="Оборот (продажи)" value={formatMoney(c.turnover, cur)} />
        <Stat label="Рентабельность вложений" value={c.roiPct == null ? "—" : formatPct(c.roiPct)} tone={c.roiPct == null ? undefined : c.roiPct >= 0 ? "pos" : "neg"} />
        <Stat label="Средняя маржа" value={c.avgMargin == null ? "—" : formatPct(c.avgMargin)} tone={c.avgMargin == null ? undefined : c.avgMargin >= 0 ? "pos" : "neg"} />
        <Stat label="Средняя прибыль/сделку" value={c.avgProfitPerDeal == null ? "—" : formatMoney(c.avgProfitPerDeal, cur, true)} tone={c.avgProfitPerDeal == null ? undefined : c.avgProfitPerDeal >= 0 ? "pos" : "neg"} sub={c.closedCount ? `${c.closedCount} закрытых` : undefined} />
        <Stat label="Лучшая сделка" value={c.bestTrade == null ? "—" : formatMoney(c.bestTrade, cur, true)} tone={c.bestTrade == null ? undefined : c.bestTrade >= 0 ? "pos" : "neg"} />
        <Stat label="Средний срок сделки" value={c.avgHoldDays == null ? "—" : `${c.avgHoldDays} дн.`} />
        <Stat label="Заморожено в холде" value={formatMoney(c.frozenInHolding, cur)} />
        <Stat label="Позиций в холде" value={String(c.holdingCount)} sub={c.holdingCount ? `можно продавать: ${c.tradableCount}` : undefined} />
        <Stat label="Мёртвый капитал" value={formatMoney(dash.deadCapital.amount, cur)} tone={dash.deadCapital.amount > 0 ? "neg" : undefined} sub={dash.deadCapital.count ? `${dash.deadCapital.count} поз. в холде > 60 дн` : "нет застрявших > 60 дн"} />
      </div>

      <DashboardCharts
        monthly={dash.monthly}
        monthlyRoi={dash.monthlyRoi}
        cumulative={dash.cumulative}
        marginByHold={dash.marginByHold}
        currency={cur}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <TopList title="Топ-5 прибыльных" deals={dash.topProfit} currency={cur} tone="pos" />
        <TopList title="Топ-5 убыточных" deals={dash.topLoss} currency={cur} tone="neg" />
      </div>

      <div className="rounded-lg border bg-card p-4">
        <h3 className="mb-3 text-sm font-medium">Площадки продажи: прибыль и маржа</h3>
        {dash.platforms.length === 0 ? (
          <p className="text-sm text-muted-foreground">Нет закрытых сделок за период.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="pb-2 font-normal">Площадка</th>
                <th className="pb-2 text-right font-normal">Сделок</th>
                <th className="pb-2 text-right font-normal">Ср. маржа</th>
                <th className="pb-2 text-right font-normal">Прибыль</th>
              </tr>
            </thead>
            <tbody>
              {dash.platforms.map((p) => (
                <tr key={p.name} className="border-t">
                  <td className="py-1.5">{p.name}</td>
                  <td className="py-1.5 text-right">{p.count}</td>
                  <td className={`py-1.5 text-right ${p.margin == null ? "text-muted-foreground" : p.margin >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {p.margin == null ? "—" : formatPct(p.margin)}
                  </td>
                  <td className={`py-1.5 text-right ${p.profit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {formatMoney(p.profit, cur, true)}
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
}: {
  label: string;
  value: string;
  tone?: "pos" | "neg";
  sub?: string;
}) {
  const color = tone === "pos" ? "text-emerald-400" : tone === "neg" ? "text-red-400" : "";
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 text-xl font-semibold ${color}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function TopList({
  title,
  deals,
  currency,
  tone,
}: {
  title: string;
  deals: DealBrief[];
  currency: string;
  tone: "pos" | "neg";
}) {
  const color = tone === "pos" ? "text-emerald-400" : "text-red-400";
  return (
    <div className="rounded-lg border bg-card p-4">
      <h3 className="mb-3 text-sm font-medium">{title}</h3>
      {deals.length === 0 ? (
        <p className="text-sm text-muted-foreground">Нет данных за период.</p>
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
                {formatMoney(d.profit, currency, true)}
                {d.margin != null && (
                  <span className="ml-1 text-xs text-muted-foreground">
                    {formatPct(d.margin)}
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
