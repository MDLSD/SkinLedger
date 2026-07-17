// Параметры списка сделок (фильтры/сортировка/страница) — общие для
// серверной выборки и клиентской панели. Всё состояние живёт в URL.
import { DEAL_STATUSES } from "@/lib/validation";

export const PAGE_SIZE = 50;

export const PERIOD_OPTIONS = [
  { value: "all", label: "Всё время" },
  { value: "week", label: "Неделя" },
  { value: "month", label: "Месяц" },
  { value: "quarter", label: "Квартал" },
  { value: "custom", label: "Период" },
] as const;
export type Period = (typeof PERIOD_OPTIONS)[number]["value"];

export const STATUS_OPTIONS = [
  { value: "all", label: "Все статусы" },
  { value: "holding", label: "В холде" },
  { value: "sold", label: "Продано" },
  { value: "withdrawn_via_skin", label: "Вывод" },
] as const;

export const SORT_COLUMNS = [
  { key: "item", label: "Скин" },
  { key: "buyPrice", label: "Покупка" },
  { key: "sellPrice", label: "Продажа" },
  { key: "profit", label: "Прибыль" },
  { key: "margin", label: "Маржа" },
  { key: "days", label: "Дней" },
  { key: "status", label: "Статус" },
  { key: "buyDate", label: "Дата" },
] as const;
export type SortKey = (typeof SORT_COLUMNS)[number]["key"];

const SORT_KEYS = SORT_COLUMNS.map((c) => c.key) as SortKey[];

export type DealFilters = {
  period: Period;
  from: string; // yyyy-MM-dd (для custom)
  to: string;
  status: string; // all | holding | sold | withdrawn_via_skin
  platform: string; // all | platformId
  q: string; // поиск по названию
  sort: SortKey;
  dir: "asc" | "desc";
  page: number; // 1-based
};

type RawParams = Record<string, string | string[] | undefined>;
const str = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export function parseDealFilters(sp: RawParams): DealFilters {
  const period = (PERIOD_OPTIONS.find((p) => p.value === str(sp.period))?.value ??
    "all") as Period;
  const status = ([...DEAL_STATUSES, "all"] as string[]).includes(str(sp.status))
    ? str(sp.status)
    : "all";
  const sort = SORT_KEYS.includes(str(sp.sort) as SortKey)
    ? (str(sp.sort) as SortKey)
    : "buyDate";
  const dir = str(sp.dir) === "asc" ? "asc" : "desc";
  const page = Math.max(1, parseInt(str(sp.page), 10) || 1);
  return {
    period,
    from: str(sp.from),
    to: str(sp.to),
    status,
    platform: str(sp.platform) || "all",
    q: str(sp.q),
    sort,
    dir,
    page,
  };
}

/** Диапазон дат покупки для выбранного периода (null — без ограничения). */
export function periodRange(f: DealFilters): { gte?: Date; lte?: Date } | null {
  const now = new Date();
  const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000);
  if (f.period === "week") return { gte: daysAgo(7) };
  if (f.period === "month") return { gte: daysAgo(30) };
  if (f.period === "quarter") return { gte: daysAgo(90) };
  if (f.period === "custom") {
    const range: { gte?: Date; lte?: Date } = {};
    if (f.from) range.gte = new Date(f.from);
    if (f.to) {
      const end = new Date(f.to);
      end.setHours(23, 59, 59, 999);
      range.lte = end;
    }
    return Object.keys(range).length ? range : null;
  }
  return null;
}

/** Собрать query-строку из фильтров с переопределениями (для клиентских ссылок). */
export function buildDealQuery(
  f: DealFilters,
  overrides: Partial<DealFilters> = {},
): string {
  const m = { ...f, ...overrides };
  const p = new URLSearchParams();
  if (m.period !== "all") p.set("period", m.period);
  if (m.period === "custom") {
    if (m.from) p.set("from", m.from);
    if (m.to) p.set("to", m.to);
  }
  if (m.status !== "all") p.set("status", m.status);
  if (m.platform !== "all") p.set("platform", m.platform);
  if (m.q) p.set("q", m.q);
  if (m.sort !== "buyDate") p.set("sort", m.sort);
  if (m.dir !== "desc") p.set("dir", m.dir);
  if (m.page > 1) p.set("page", String(m.page));
  const s = p.toString();
  return s ? `?${s}` : "";
}
