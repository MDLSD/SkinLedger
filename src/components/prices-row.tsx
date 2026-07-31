"use client";

import { useEffect, useState } from "react";
import {
  ArrowLeftRight,
  Check,
  Copy,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Link } from "@/i18n/navigation";
import { TableCell, TableRow } from "@/components/ui/table";
import { SourceIcon } from "@/components/source-icon";
import { formatMoney, formatPct } from "@/lib/deal-math";
import type { ComparisonRow } from "@/lib/prices/compare";
import {
  PERIODS,
  type ItemDetail,
  type Period,
  type SourceDetail,
} from "@/lib/prices/detail";

const SELL_COLOR = "#f0562a"; // запросы на продажу — как в референсе
const BUY_COLOR = "#4a90d9"; // запросы на покупку
const LINE = "#58e2b0";
const GRID = "rgba(255,255,255,0.07)";
const AXIS = "#92a1bf";

type Props = {
  r: ComparisonRow;
  buy: string;
  sell: string;
  buyTitle: string;
  sellTitle: string;
  cur: string;
  fx: number | null;
  now: number;
  colSpan: number;
};

/** «3 мин», «6 ч», «2 д» — свежесть котировки. */
function ago(d: Date, now: number): string {
  const min = Math.max(0, Math.round((now - new Date(d).getTime()) / 60000));
  if (min < 1) return "только что";
  if (min < 60) return `${min} мин`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} ч`;
  return `${Math.round(h / 24)} д`;
}

/** Цена: мелко USD над ценой в валюте пользователя, справа — предложения. */
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
    <span className="flex items-end justify-between gap-3">
      <span className="tabular-nums">
        {!single && (
          <span className="block text-xs text-muted-foreground">
            {formatMoney(usd, "USD")}
          </span>
        )}
        <span className="block text-sm font-medium">
          {single ? formatMoney(usd, "USD") : formatMoney(usd * factor, cur)}
        </span>
      </span>
      {offers != null && (
        <span className="text-xs tabular-nums text-muted-foreground">
          {offers.toLocaleString("ru-RU")}
        </span>
      )}
    </span>
  );
}

/** Превью предмета: ссылка на публичную страницу, если у предмета есть slug. */
function SkinThumb({
  slug,
  image,
  name,
}: {
  slug: string | null;
  image: string | null;
  name: string;
}) {
  const box = "block h-10 w-14 shrink-0 rounded bg-muted/40 object-contain";
  const img = image ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={image} alt="" className={box} loading="lazy" />
  ) : (
    <span className={box} />
  );
  if (!slug) return img;
  return (
    <Link
      href={`/skins/${slug}`}
      title={`Открыть страницу «${name}»`}
      className="shrink-0 rounded transition-opacity hover:opacity-80"
    >
      {img}
    </Link>
  );
}

export function PriceRow({ r, buy, sell, buyTitle, sellTitle, cur, fx, now, colSpan }: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const pos = r.profit > 0;
  const tone = pos ? "text-primary" : "text-destructive";

  const copyName = async () => {
    try {
      await navigator.clipboard.writeText(r.marketHashName);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Буфер недоступен (нет разрешения / http) — молча не копируем.
    }
  };

  return (
    <>
      <TableRow className="border-border/60">
        {/* Предмет: клик по названию копирует market_hash_name */}
        <TableCell className="max-w-[420px]">
          <span className="flex items-center gap-3">
            {/* Картинка ведёт на страницу предмета (ТЗ 3.4); клик по названию
                оставлен под копирование market_hash_name. */}
            <SkinThumb slug={r.slug} image={r.image} name={r.marketHashName} />
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
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
              </span>
              <button
                type="button"
                onClick={copyName}
                title={`Скопировать «${r.marketHashName}»`}
                className="group flex max-w-full items-center gap-1.5 text-left text-sm hover:text-primary"
              >
                <span className="truncate">{r.titleMain}</span>
                {copied ? (
                  <Check className="size-3.5 shrink-0 text-primary" />
                ) : (
                  <Copy className="size-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-60" />
                )}
              </button>
            </span>
          </span>
        </TableCell>

        {/* Цены: клик раскрывает панель с графиком и стаканом */}
        <TableCell className="p-0">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className={`block w-full px-4 py-3 text-left transition-colors hover:bg-muted/40 ${
              open ? "bg-muted/30" : ""
            }`}
            title="Показать график и стакан"
          >
            <PriceCell usd={r.buyPrice} cur={cur} factor={fx} offers={r.buyOffers} />
          </button>
        </TableCell>
        <TableCell className="p-0">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className={`block w-full px-4 py-3 text-left transition-colors hover:bg-muted/40 ${
              open ? "bg-muted/30" : ""
            }`}
            title="Показать график и стакан"
          >
            <PriceCell usd={r.sellPrice} cur={cur} factor={fx} offers={r.sellOffers} />
          </button>
        </TableCell>

        {/* Прибыль: маржа сверху, абсолютная снизу */}
        <TableCell className={`tabular-nums ${tone}`}>
          <span className="flex items-center gap-1.5 text-xs">
            {pos ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
            {formatPct(r.profitPct)}
          </span>
          <span className="flex items-center gap-1.5 text-sm font-medium">
            <ArrowLeftRight className="size-3.5 opacity-70" />
            {fx == null ? formatMoney(r.profit, "USD", true) : formatMoney(r.profit * fx, cur, true)}
          </span>
        </TableCell>

        {/* Свежесть котировок по обеим площадкам */}
        <TableCell className="text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <SourceIcon slug={buy} title={buyTitle} className="size-3.5 text-[7px]" />
            {ago(r.buyFetchedAt, now)}
          </span>
          <span className="mt-1 flex items-center gap-1.5">
            <SourceIcon slug={sell} title={sellTitle} className="size-3.5 text-[7px]" />
            {ago(r.sellFetchedAt, now)}
          </span>
        </TableCell>

        {/* Продажи за 30 дней на обеих площадках */}
        <TableCell>
          <span className="flex items-center gap-4 text-xs tabular-nums">
            <span className="flex flex-col items-center gap-1">
              <SourceIcon slug={buy} title={buyTitle} className="size-4 text-[8px]" />
              <span className="text-muted-foreground">
                {r.buySales != null ? r.buySales.toLocaleString("ru-RU") : "—"}
              </span>
            </span>
            <span className="flex flex-col items-center gap-1">
              <SourceIcon slug={sell} title={sellTitle} className="size-4 text-[8px]" />
              <span className="text-muted-foreground">
                {r.liquidity != null ? r.liquidity.toLocaleString("ru-RU") : "—"}
              </span>
            </span>
          </span>
        </TableCell>
      </TableRow>

      {open && (
        <TableRow className="border-border/60 hover:bg-transparent">
          <TableCell colSpan={colSpan} className="bg-background/40 p-0">
            <ItemPanel
              item={r.marketHashName}
              slugs={[buy, sell]}
              titles={{ [buy]: buyTitle, [sell]: sellTitle }}
              cur={cur}
              fx={fx}
            />
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

/** Панель предмета: по блоку на площадку — график, стакан и статистика. */
function ItemPanel({
  item,
  slugs,
  titles,
  cur,
  fx,
}: {
  item: string;
  slugs: string[];
  titles: Record<string, string>;
  cur: string;
  fx: number | null;
}) {
  const [period, setPeriod] = useState<Period>("1w");
  const [data, setData] = useState<ItemDetail | null>(null);
  // Период, на котором запрос упал: так ошибка сама «сбрасывается» при смене
  // периода и не нужно чистить состояние синхронно внутри эффекта.
  const [failed, setFailed] = useState<Period | null>(null);
  // Массив в зависимостях эффекта каждый рендер новый — ключуемся строкой.
  const sourcesKey = slugs.join(",");

  useEffect(() => {
    let alive = true;
    const url =
      `/api/prices/history?item=${encodeURIComponent(item)}` +
      `&sources=${encodeURIComponent(sourcesKey)}&period=${period}`;
    fetch(url)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((d: ItemDetail) => alive && setData(d))
      .catch(() => alive && setFailed(period));
    return () => {
      alive = false;
    };
  }, [item, period, sourcesKey]);

  const error = failed === period;
  const loading = !error && (!data || data.period !== period);

  return (
    <div className="grid gap-px bg-border/60 lg:grid-cols-2">
      {slugs.map((slug) => (
        <SourcePanel
          key={slug}
          slug={slug}
          title={titles[slug] ?? slug}
          detail={data?.period === period ? (data.sources.find((s) => s.sourceSlug === slug) ?? null) : null}
          loading={loading}
          error={error}
          period={period}
          onPeriod={setPeriod}
          cur={cur}
          fx={fx}
        />
      ))}
    </div>
  );
}

function SourcePanel({
  slug,
  title,
  detail,
  loading,
  error,
  period,
  onPeriod,
  cur,
  fx,
}: {
  slug: string;
  title: string;
  detail: SourceDetail | null;
  loading: boolean;
  error: boolean;
  period: Period;
  onPeriod: (p: Period) => void;
  cur: string;
  fx: number | null;
}) {
  const [tab, setTab] = useState<"sales" | "orders">("sales");
  const money = (usd: number) =>
    fx == null || cur === "USD" ? formatMoney(usd, "USD") : formatMoney(usd * fx, cur);

  return (
    <div className="bg-card">
      {/* Шапка блока: площадка, вкладки, период */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border/60 px-4 py-2">
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          <SourceIcon slug={slug} title={title} className="size-4 text-[8px]" />
          <span className="max-w-24 truncate">{title}</span>
        </span>
        <Tab active={tab === "sales"} onClick={() => setTab("sales")}>
          Продажи
        </Tab>
        <Tab active={tab === "orders"} onClick={() => setTab("orders")}>
          Ордера
        </Tab>
        <span className="ml-auto flex items-center gap-1">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => onPeriod(p.value)}
              className={`rounded px-2 py-0.5 text-xs transition-colors ${
                period === p.value
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {p.label}
            </button>
          ))}
        </span>
      </div>

      <div className="grid gap-4 p-4 md:grid-cols-[1fr_240px]">
        {/* График продаж */}
        <div className="h-56">
          {loading ? (
            <Centered>Загрузка…</Centered>
          ) : error ? (
            <Centered>Не удалось загрузить историю</Centered>
          ) : tab === "orders" ? (
            <Centered>
              История ордеров не собирается — источник отдаёт только текущую цену ордера
            </Centered>
          ) : !detail || detail.points.length === 0 ? (
            <Centered>Нет данных за период</Centered>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={detail.points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id={`g-${slug}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={LINE} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={LINE} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis
                  dataKey="t"
                  type="number"
                  domain={["dataMin", "dataMax"]}
                  tickFormatter={(t: number) =>
                    new Date(t).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" })
                  }
                  stroke={AXIS}
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={24}
                />
                <YAxis
                  stroke={AXIS}
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  width={64}
                  tickFormatter={(v: number) => money(v)}
                  domain={["auto", "auto"]}
                />
                <Tooltip
                  content={(raw: unknown) => {
                    const { active, payload } = raw as {
                      active?: boolean;
                      payload?: readonly { payload?: { t: number; p: number } }[];
                    };
                    const pt = payload?.[0]?.payload;
                    if (!active || !pt) return null;
                    return (
                      <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-md">
                        <div className="text-muted-foreground">
                          {new Date(pt.t).toLocaleString("ru-RU", {
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                        <div className="font-medium text-primary">{money(pt.p)}</div>
                      </div>
                    );
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="p"
                  stroke={LINE}
                  strokeWidth={2}
                  fill={`url(#g-${slug})`}
                  dot={false}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Стакан: лучший уровень с каждой стороны, остальное — нет данных */}
        <div className="space-y-1 text-xs">
          <div className="flex items-center gap-1.5 font-medium" style={{ color: SELL_COLOR }}>
            <span className="size-2 rounded-[2px]" style={{ background: SELL_COLOR }} />
            Запросы на продажу
          </div>
          <BookRows level={detail?.sell ?? null} color={SELL_COLOR} money={money} />

          <div
            className="flex items-center gap-1.5 pt-2 font-medium"
            style={{ color: BUY_COLOR }}
          >
            <span className="size-2 rounded-[2px]" style={{ background: BUY_COLOR }} />
            Запросы на покупку
          </div>
          <BookRows level={detail?.buy ?? null} color={BUY_COLOR} money={money} />
        </div>
      </div>

      {/* Статистика продаж за период */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 border-t border-border/60 px-4 py-2 text-xs text-muted-foreground">
        <span>Статистика продаж</span>
        <span className="ml-auto flex flex-wrap gap-x-4 tabular-nums">
          <span>
            Мин: <span className="text-foreground">{detail?.min != null ? money(detail.min) : "—"}</span>
          </span>
          <span>
            Макс: <span className="text-foreground">{detail?.max != null ? money(detail.max) : "—"}</span>
          </span>
          <span>
            Средняя:{" "}
            <span className="text-foreground">{detail?.avg != null ? money(detail.avg) : "—"}</span>
          </span>
        </span>
      </div>
    </div>
  );
}

/** Пять строк стакана: известный уровень + «Нет данных» под остальные. */
function BookRows({
  level,
  color,
  money,
}: {
  level: { price: number; count: number | null } | null;
  color: string;
  money: (usd: number) => string;
}) {
  const rows = [0, 1, 2, 3, 4];
  const at = 2; // известный уровень — в середине, как в референсе
  return (
    <div className="space-y-0.5">
      {rows.map((i) =>
        i === at && level ? (
          <div
            key={i}
            className="flex items-center justify-between rounded px-1.5 py-0.5 tabular-nums"
            style={{ background: `${color}1a` }}
          >
            <span className="text-foreground">
              {level.count != null ? level.count.toLocaleString("ru-RU") : "—"}
            </span>
            <span style={{ color }}>{money(level.price)}</span>
          </div>
        ) : (
          <div key={i} className="flex items-center justify-between px-1.5 py-0.5 text-muted-foreground/60">
            <span>—</span>
            <span>Нет данных</span>
          </div>
        ),
      )}
    </div>
  );
}

function Tab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md border px-2 py-1 text-xs transition-colors ${
        active
          ? "border-primary/60 bg-primary/10 text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full items-center justify-center px-6 text-center text-xs text-muted-foreground">
      {children}
    </div>
  );
}
