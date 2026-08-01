// Параметры списка сделок (фильтры/сортировка/страница) — общие для
// серверной выборки и клиентской панели. Всё состояние живёт в URL.
import { DEAL_STATUSES } from "@/lib/validation";

export const PAGE_SIZE = 50;

// Подписи опций лежат в messages (dealsToolbar.period.* / .status.* /
// deals.sort.*): здесь только значения, они же ключи перевода и значения в URL.
export const PERIOD_OPTIONS = ["all", "week", "month", "quarter", "custom"] as const;
export type Period = (typeof PERIOD_OPTIONS)[number];

export const STATUS_OPTIONS = ["all", "holding", "sold"] as const;

// Только ключи: подписи колонок берутся из переводов в самом компоненте.
export const SORT_COLUMNS = [
  { key: "item" },
  { key: "buyPrice" },
  { key: "sellPrice" },
  { key: "profit" },
  { key: "margin" },
  { key: "days" },
  { key: "status" },
  { key: "buyDate" },
] as const;
export type SortKey = (typeof SORT_COLUMNS)[number]["key"];

const SORT_KEYS = SORT_COLUMNS.map((c) => c.key) as SortKey[];

export type DealFilters = {
  period: Period;
  from: string; // yyyy-MM-dd (для custom)
  to: string;
  status: string; // all | holding | sold
  platform: string; // all | platformId
  q: string; // поиск по названию
  sort: SortKey;
  dir: "asc" | "desc";
  page: number; // 1-based
};

type RawParams = Record<string, string | string[] | undefined>;
const str = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export function parseDealFilters(sp: RawParams): DealFilters {
  const period = ((PERIOD_OPTIONS as readonly string[]).includes(str(sp.period))
    ? str(sp.period)
    : "all") as Period;
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
    // Строка поиска гоняется через .includes() по каждой сделке и складывается
    // обратно в URL — длину ограничиваем при разборе.
    q: str(sp.q).slice(0, 100),
    sort,
    dir,
    page,
  };
}

/**
 * Диапазон дат для выбранного периода (null — без ограничения).
 * Применяется к дате ЗАКРЫТИЯ сделки — одинаково в списке и на дашборде.
 */
export function periodRange(
  f: Pick<DealFilters, "period" | "from" | "to">,
): { gte?: Date; lte?: Date } | null {
  const now = new Date();
  const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000);
  if (f.period === "week") return { gte: daysAgo(7) };
  if (f.period === "month") return { gte: daysAgo(30) };
  if (f.period === "quarter") return { gte: daysAgo(90) };
  if (f.period === "custom") {
    const range: { gte?: Date; lte?: Date } = {};
    const start = validDate(f.from);
    if (start) range.gte = start;
    const end = validDate(f.to);
    if (end) {
      end.setHours(23, 59, 59, 999);
      if (!Number.isNaN(end.getTime())) range.lte = end;
    }
    return Object.keys(range).length ? range : null;
  }
  return null;
}

// Разбор даты из URL: некорректная строка → undefined (не роняем Prisma).
// Формат строго yyyy-MM-dd, год в разумных границах: иначе граничные значения
// вроде 275760-09-13 проходят isNaN, но становятся Invalid Date после setHours.
function validDate(s: string): Date | undefined {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return undefined;
  const d = new Date(`${s}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return undefined;
  const y = d.getUTCFullYear();
  return y >= 2000 && y <= 2100 ? d : undefined;
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
