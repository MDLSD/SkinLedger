"use client";

import { useFormatter, useLocale, useTranslations } from "next-intl";
import { withDynamicKeys, type DynamicTranslator } from "@/i18n/dynamic";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatMoney } from "@/lib/deal-math";
import { Hint } from "@/components/hint";

// Цвета под тёмную тему (палитра референса).
const POS = "#58e2b0"; // мятно-зелёный (акцент)
const NEG = "#f87171"; // роза
const LINE = "#60a5fa"; // голубой
const GRID = "rgba(255,255,255,0.07)";
const AXIS = "#92a1bf"; // приглушённый bluish

/** Компактная подпись оси. Сокращения «млн»/«к» — из переводов. */
function makeCompact(t: DynamicTranslator) {
  return (v: number): string => {
    const a = Math.abs(v);
    if (a >= 1_000_000) return t("million", { v: (v / 1_000_000).toFixed(1) });
    if (a >= 1000) return t("thousand", { v: Math.round(v / 1000) });
    return String(Math.round(v));
  };
}

// Тултип; recharts вызывает content с собственным типом props — принимаем
// unknown и извлекаем нужное.
function renderTip(currency: string, locale: string) {
  return (raw: unknown) => {
    const { active, payload, label } = raw as {
      active?: boolean;
      payload?: readonly { value?: number | string }[];
      label?: React.ReactNode;
    };
    if (!active || !payload?.length) return null;
    const v = Number(payload[0].value ?? 0);
    return (
      <div className="rounded-md border bg-popover px-3 py-2 text-sm shadow-md">
        <div className="text-muted-foreground">{label}</div>
        <div className="font-medium" style={{ color: v >= 0 ? POS : NEG }}>
          {formatMoney(v, currency, locale, true)}
        </div>
      </div>
    );
  };
}

// Тултип для процентных графиков (ROI, маржа); опц. вторая строка (кол-во).
function renderPctTip(unit: string, dealsLabel: (n: number) => string) {
  return (raw: unknown) => {
    const { active, payload, label } = raw as {
      active?: boolean;
      payload?: readonly { value?: number | string; payload?: { count?: number } }[];
      label?: React.ReactNode;
    };
    if (!active || !payload?.length) return null;
    const v = Number(payload[0].value ?? 0);
    const count = payload[0].payload?.count;
    return (
      <div className="rounded-md border bg-popover px-3 py-2 text-sm shadow-md">
        <div className="text-muted-foreground">{label}</div>
        <div className="font-medium" style={{ color: v >= 0 ? POS : NEG }}>
          {v} % {unit}
        </div>
        {count != null && <div className="text-xs text-muted-foreground">{dealsLabel(count)}</div>}
      </div>
    );
  };
}

type Props = {
  monthly: { label: string; profit: number }[];
  monthlyRoi: { label: string; roiPct: number }[];
  cumulative: { label: string; value: number }[];
  marginByHold: { label: string; margin: number | null; count: number }[];
  currency: string;
};

export function DashboardCharts({
  monthly,
  monthlyRoi,
  cumulative,
  marginByHold,
  currency,
}: Props) {
  const t = useTranslations("charts");
  const td = withDynamicKeys(t);
  const locale = useLocale();
  const format = useFormatter();
  const empty = monthly.length === 0;
  const compact = makeCompact(td);
  const dealsLabel = (n: number) => t("dealsCount", { count: n });

  // Метки приходят машинными ("2026-06" и ключи корзин холда): месяц
  // раскрывается по локали, корзины — из переводов.
  const monthLabel = (key: string) => {
    const [y, m] = key.split("-").map(Number);
    return format.dateTime(new Date(y, m - 1, 1), { month: "short", year: "2-digit" });
  };
  const withMonthLabels = <T extends { label: string }>(rows: T[]): T[] =>
    rows.map((r) => ({ ...r, label: monthLabel(r.label) }));

  const monthlyL = withMonthLabels(monthly);
  const monthlyRoiL = withMonthLabels(monthlyRoi);
  const cumulativeL = withMonthLabels(cumulative);
  const marginByHoldL = marginByHold.map((r) => ({
    ...r,
    label: td(`holdBin.${r.label}`),
  }));

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-lg border bg-card p-4">
        <h3 className="mb-3 flex items-center gap-1 text-sm font-medium">
          {t("monthlyProfit")}
          <Hint text={t("monthlyProfitHint")} />
        </h3>
        {empty ? (
          <Placeholder />
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={monthlyL} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={GRID} />
              <XAxis
                dataKey="label"
                tick={{ fill: AXIS, fontSize: 12 }}
                tickLine={false}
                axisLine={{ stroke: GRID }}
              />
              <YAxis
                tick={{ fill: AXIS, fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                width={52}
                tickFormatter={compact}
              />
              <ReferenceLine y={0} stroke={AXIS} />
              <Tooltip
                cursor={{ fill: "rgba(255,255,255,0.06)" }}
                content={renderTip(currency, locale)}
              />
              <Bar dataKey="profit" radius={[4, 4, 0, 0]}>
                {monthlyL.map((d, i) => (
                  <Cell key={i} fill={d.profit >= 0 ? POS : NEG} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="rounded-lg border bg-card p-4">
        <h3 className="mb-3 flex items-center gap-1 text-sm font-medium">
          {t("cumulative")}
          <Hint text={t("cumulativeHint")} />
        </h3>
        {empty ? (
          <Placeholder />
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={cumulativeL} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={GRID} />
              <XAxis
                dataKey="label"
                tick={{ fill: AXIS, fontSize: 12 }}
                tickLine={false}
                axisLine={{ stroke: GRID }}
              />
              <YAxis
                tick={{ fill: AXIS, fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                width={52}
                tickFormatter={compact}
              />
              <ReferenceLine y={0} stroke={AXIS} strokeDasharray="3 3" />
              <Tooltip content={renderTip(currency, locale)} />
              <Line
                type="monotone"
                dataKey="value"
                stroke={LINE}
                strokeWidth={2}
                dot={{ r: 3, fill: LINE }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="rounded-lg border bg-card p-4">
        <h3 className="mb-3 flex items-center gap-1 text-sm font-medium">
          {t("monthlyRoi")}
          <Hint text={t("monthlyRoiHint")} />
        </h3>
        {empty ? (
          <Placeholder />
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={monthlyRoiL} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={GRID} />
              <XAxis dataKey="label" tick={{ fill: AXIS, fontSize: 12 }} tickLine={false} axisLine={{ stroke: GRID }} />
              <YAxis tick={{ fill: AXIS, fontSize: 12 }} tickLine={false} axisLine={false} width={40} tickFormatter={(v) => `${v}`} />
              <ReferenceLine y={0} stroke={AXIS} />
              <Tooltip cursor={{ fill: "rgba(255,255,255,0.06)" }} content={renderPctTip(t("roiUnit"), dealsLabel)} />
              <Bar dataKey="roiPct" radius={[4, 4, 0, 0]}>
                {monthlyRoiL.map((d, i) => (
                  <Cell key={i} fill={d.roiPct >= 0 ? POS : NEG} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="rounded-lg border bg-card p-4">
        <h3 className="mb-1 flex items-center gap-1 text-sm font-medium">
          {t("marginByHold")}
          <Hint text={t("marginByHoldHint")} />
        </h3>
        <p className="mb-2 text-xs text-muted-foreground">
          {t("marginByHoldNote")}
        </p>
        {empty ? (
          <Placeholder />
        ) : (
          <ResponsiveContainer width="100%" height={216}>
            <BarChart data={marginByHoldL} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={GRID} />
              <XAxis dataKey="label" tick={{ fill: AXIS, fontSize: 12 }} tickLine={false} axisLine={{ stroke: GRID }} />
              <YAxis tick={{ fill: AXIS, fontSize: 12 }} tickLine={false} axisLine={false} width={40} />
              <ReferenceLine y={0} stroke={AXIS} />
              <Tooltip cursor={{ fill: "rgba(255,255,255,0.06)" }} content={renderPctTip(t("marginUnit"), dealsLabel)} />
              <Bar dataKey="margin" radius={[4, 4, 0, 0]}>
                {marginByHoldL.map((d, i) => (
                  <Cell key={i} fill={(d.margin ?? 0) >= 0 ? POS : NEG} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function Placeholder() {
  const t = useTranslations("charts");
  return (
    <div className="flex h-[240px] items-center justify-center text-sm text-muted-foreground">
      {t("empty")}
    </div>
  );
}
