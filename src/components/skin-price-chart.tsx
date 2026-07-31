"use client";

import { useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatMoney } from "@/lib/deal-math";
import type { ChartPoint } from "@/lib/prices/item-page";

// До пяти линий (ТЗ 3.4) — палитра фиксированная, чтобы цвет площадки не
// прыгал между предметами.
const COLORS = ["#58e2b0", "#60a5fa", "#f0a020", "#c084fc", "#f87171"];
const GRID = "rgba(255,255,255,0.07)";
const AXIS = "#92a1bf";

// Пресеты периода (ТЗ 3.4). Вся история уже на странице, поэтому переключение
// не ходит на сервер — иначе страница стала бы динамической и потеряла ISR.
const PRESETS = [
  { label: "1н", days: 7 },
  { label: "1м", days: 30 },
  { label: "3м", days: 90 },
  { label: "6м", days: 180 },
  { label: "Всё", days: null },
] as const;

/** Компактная подпись оси: «16,6 к ₽» вместо «16 619,62 ₽» — иначе перенос. */
function tick(v: number, cur: string): string {
  const abs = Math.abs(v);
  const sym = cur === "USD" ? "$" : cur === "RUB" ? "₽" : cur;
  if (abs >= 1000) return `${(v / 1000).toLocaleString("ru-RU", { maximumFractionDigits: 1 })} к ${sym}`;
  return `${v.toLocaleString("ru-RU", { maximumFractionDigits: abs < 10 ? 2 : 0 })} ${sym}`;
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

type Props = {
  points: ChartPoint[];
  sources: { slug: string; title: string }[];
  cur: string;
  fx: number | null;
  /** Отсечка времени с сервера: Date.now() в рендере — нечистая функция. */
  now: number;
};

export function SkinPriceChart({ points, sources, cur, fx, now }: Props) {
  // Переключатель площадок: данные уже на странице, скрываем/показываем линии.
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [days, setDays] = useState<number | null>(30);
  const money = (usd: number) =>
    fx == null || cur === "USD" ? formatMoney(usd, "USD") : formatMoney(usd * fx, cur);

  const toggle = (slug: string) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else if (next.size < sources.length - 1) next.add(slug); // одна линия всегда видна
      return next;
    });

  const cutoff = days == null ? 0 : now - days * 86400_000;
  const shown = points.filter((p) => p.t >= cutoff);

  // Статистика за выбранный период — по медиане видимых площадок на момент.
  const visible = sources.filter((s) => !hidden.has(s.slug));
  const series = shown
    .map((p) =>
      median(
        visible
          .map((s) => p[s.slug])
          .filter((v): v is number => typeof v === "number"),
      ),
    )
    .filter((v): v is number => v != null);
  const stats = series.length
    ? {
        min: Math.min(...series),
        max: Math.max(...series),
        avg: series.reduce((a, b) => a + b, 0) / series.length,
      }
    : null;

  if (!points.length) {
    return (
      <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">
        За выбранный период истории цен нет.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {sources.map((s, i) => {
          const off = hidden.has(s.slug);
          return (
            <button
              key={s.slug}
              type="button"
              onClick={() => toggle(s.slug)}
              className={`flex items-center gap-2 rounded-lg border px-2.5 py-1 text-xs transition-colors ${
                off
                  ? "border-border text-muted-foreground"
                  : "border-border bg-muted/40 text-foreground"
              }`}
              title={off ? "Показать линию" : "Скрыть линию"}
            >
              <span
                className="size-2.5 rounded-sm"
                style={{ background: off ? "transparent" : COLORS[i % COLORS.length], border: `1px solid ${COLORS[i % COLORS.length]}` }}
              />
              {s.title}
            </button>
          );
        })}
        <span className="ml-auto flex items-center gap-1">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => setDays(p.days)}
              className={`rounded px-2 py-1 text-xs transition-colors ${
                days === p.days
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {p.label}
            </button>
          ))}
        </span>
      </div>

      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={shown} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis
              dataKey="t"
              type="number"
              domain={["dataMin", "dataMax"]}
              scale="time"
              tickFormatter={(t: number) =>
                new Date(t).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" })
              }
              stroke={AXIS}
              fontSize={11}
              tickLine={false}
              axisLine={false}
              minTickGap={32}
            />
            <YAxis
              stroke={AXIS}
              fontSize={11}
              tickLine={false}
              axisLine={false}
              width={68}
              tickFormatter={(v: number) => tick(fx == null ? v : v * fx, fx == null ? "USD" : cur)}
              domain={["auto", "auto"]}
            />
            <Tooltip
              content={(raw: unknown) => {
                const { active, payload, label } = raw as {
                  active?: boolean;
                  payload?: readonly { dataKey?: string; value?: number; color?: string }[];
                  label?: number;
                };
                if (!active || !payload?.length) return null;
                return (
                  <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-md">
                    <div className="mb-1 text-muted-foreground">
                      {new Date(Number(label)).toLocaleString("ru-RU", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "2-digit",
                      })}
                    </div>
                    {payload.map((p) => {
                      const src = sources.find((s) => s.slug === p.dataKey);
                      if (p.value == null) return null;
                      return (
                        <div key={p.dataKey} className="flex justify-between gap-4">
                          <span style={{ color: p.color }}>{src?.title ?? p.dataKey}</span>
                          <span className="tabular-nums">{money(Number(p.value))}</span>
                        </div>
                      );
                    })}
                  </div>
                );
              }}
            />
            {sources.map((s, i) =>
              hidden.has(s.slug) ? null : (
                <Line
                  key={s.slug}
                  type="monotone"
                  dataKey={s.slug}
                  stroke={COLORS[i % COLORS.length]}
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                  isAnimationActive={false}
                />
              ),
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {stats && (
        <div className="flex flex-wrap gap-x-6 gap-y-1 border-t border-border/60 pt-3 text-xs text-muted-foreground">
          <span>За период</span>
          <span className="ml-auto flex flex-wrap gap-x-4 tabular-nums">
            <span>
              Мин: <span className="text-foreground">{money(stats.min)}</span>
            </span>
            <span>
              Макс: <span className="text-foreground">{money(stats.max)}</span>
            </span>
            <span>
              Средняя: <span className="text-foreground">{money(stats.avg)}</span>
            </span>
          </span>
        </div>
      )}
    </div>
  );
}
