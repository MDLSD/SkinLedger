"use client";

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

const POS = "#059669";
const NEG = "#dc2626";
const LINE = "#2563eb";
const GRID = "#e5e7eb";
const AXIS = "#6b7280";

function compact(v: number): string {
  const a = Math.abs(v);
  if (a >= 1_000_000) return `${(v / 1_000_000).toFixed(1)} млн`;
  if (a >= 1000) return `${Math.round(v / 1000)} к`;
  return String(Math.round(v));
}

// Тултип; recharts вызывает content с собственным типом props — принимаем
// unknown и извлекаем нужное.
function renderTip(currency: string) {
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
          {formatMoney(v, currency, true)}
        </div>
      </div>
    );
  };
}

type Props = {
  monthly: { label: string; profit: number }[];
  cumulative: { label: string; value: number }[];
  currency: string;
};

export function DashboardCharts({ monthly, cumulative, currency }: Props) {
  const empty = monthly.length === 0;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-lg border p-4">
        <h3 className="mb-3 text-sm font-medium">Прибыль по месяцам</h3>
        {empty ? (
          <Placeholder />
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={monthly} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
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
                cursor={{ fill: "rgba(0,0,0,0.04)" }}
                content={renderTip(currency)}
              />
              <Bar dataKey="profit" radius={[4, 4, 0, 0]}>
                {monthly.map((d, i) => (
                  <Cell key={i} fill={d.profit >= 0 ? POS : NEG} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="rounded-lg border p-4">
        <h3 className="mb-3 text-sm font-medium">Кумулятивная прибыль</h3>
        {empty ? (
          <Placeholder />
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={cumulative} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
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
              <Tooltip content={renderTip(currency)} />
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
    </div>
  );
}

function Placeholder() {
  return (
    <div className="flex h-[240px] items-center justify-center text-sm text-muted-foreground">
      Нет закрытых сделок за период
    </div>
  );
}
