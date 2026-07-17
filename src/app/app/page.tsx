import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { formatMoney, formatPct } from "@/lib/deal-math";
import { parseDealFilters, periodRange } from "@/lib/deal-list";
import { computeDashboard, type DashDeal, type DealBrief } from "@/lib/dashboard";
import { DashboardCharts } from "@/components/dashboard-charts";
import { DashboardPeriod } from "@/components/dashboard-period";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const MAX_ROWS = 5000;

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

  const [user, dealRows] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId } }),
    prisma.deal.findMany({
      where: { userId },
      include: { sellPlatform: true },
      take: MAX_ROWS,
    }),
  ]);
  const cur = user.baseCurrency;

  const deals: DashDeal[] = dealRows.map((d) => ({
    id: d.id,
    itemName: d.itemName,
    itemQuality: d.itemQuality,
    status: d.status,
    buyDate: d.buyDate,
    sellDate: d.sellDate,
    quantity: d.quantity,
    buyPrice: Number(d.buyPrice),
    buyFeePct: Number(d.buyFeePct),
    buyFxRate: Number(d.buyFxRate),
    sellPrice: d.sellPrice != null ? Number(d.sellPrice) : null,
    sellFeePct: d.sellFeePct != null ? Number(d.sellFeePct) : null,
    sellFxRate: d.sellFxRate != null ? Number(d.sellFxRate) : null,
    sellPlatformName: d.sellPlatform?.name ?? null,
  }));

  const dash = computeDashboard(deals, range);
  const c = dash.cards;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Дашборд</h1>
        <DashboardPeriod period={f.period} from={f.from} to={f.to} />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat label="Чистая прибыль" value={formatMoney(c.netProfit, cur, true)} tone={c.netProfit >= 0 ? "pos" : "neg"} />
        <Stat label="Оборот (продажи)" value={formatMoney(c.turnover, cur)} />
        <Stat label="Средняя маржа" value={c.avgMargin == null ? "—" : formatPct(c.avgMargin)} tone={c.avgMargin == null ? undefined : c.avgMargin >= 0 ? "pos" : "neg"} />
        <Stat label="Закрыто сделок" value={String(c.closedCount)} />
        <Stat label="Потери на выводе" value={c.withdrawalLoss > 0 ? formatMoney(-c.withdrawalLoss, cur, true) : "—"} tone={c.withdrawalLoss > 0 ? "neg" : undefined} />
        <Stat label="Заморожено в холде" value={formatMoney(c.frozenInHolding, cur)} />
      </div>

      <DashboardCharts monthly={dash.monthly} cumulative={dash.cumulative} currency={cur} />

      <div className="grid gap-4 lg:grid-cols-2">
        <TopList title="Топ-5 прибыльных" deals={dash.topProfit} currency={cur} tone="pos" />
        <TopList title="Топ-5 убыточных" deals={dash.topLoss} currency={cur} tone="neg" />
      </div>

      <div className="rounded-lg border p-4">
        <h3 className="mb-3 text-sm font-medium">Прибыль по площадкам продажи</h3>
        {dash.platforms.length === 0 ? (
          <p className="text-sm text-muted-foreground">Нет закрытых сделок за период.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="pb-2 font-normal">Площадка</th>
                <th className="pb-2 text-right font-normal">Сделок</th>
                <th className="pb-2 text-right font-normal">Прибыль</th>
              </tr>
            </thead>
            <tbody>
              {dash.platforms.map((p) => (
                <tr key={p.name} className="border-t">
                  <td className="py-1.5">{p.name}</td>
                  <td className="py-1.5 text-right">{p.count}</td>
                  <td className={`py-1.5 text-right ${p.profit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
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
}: {
  label: string;
  value: string;
  tone?: "pos" | "neg";
}) {
  const color = tone === "pos" ? "text-emerald-600" : tone === "neg" ? "text-red-600" : "";
  return (
    <div className="rounded-lg border p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 text-xl font-semibold ${color}`}>{value}</div>
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
  const color = tone === "pos" ? "text-emerald-600" : "text-red-600";
  return (
    <div className="rounded-lg border p-4">
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
