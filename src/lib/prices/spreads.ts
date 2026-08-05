// Параметры страницы «Топ связок» (ТЗ раздел 5, /app/spreads). Чистый модуль
// без prisma: импортируется и панелью фильтров на клиенте, и загрузчиком.
//
// Отличие от таблицы сравнения: там пара площадок задана пользователем, здесь
// для каждого предмета ищется ЛУЧШАЯ пара из всех.

export const SPREADS_PAGE_SIZE = 50;

export const SPREAD_SORTS = [
  { key: "profitPct", label: "margin" },
  { key: "profit", label: "profit" },
  { key: "buy", label: "buyPrice" },
  { key: "liq", label: "liquidity" },
] as const;

export type SpreadSort = (typeof SPREAD_SORTS)[number]["key"];
const SORT_KEYS = SPREAD_SORTS.map((s) => s.key) as SpreadSort[];

export type SpreadFilters = {
  q: string;
  minProfit: string; // минимальная маржа, %
  minLiq: string; // минимум продаж/30д на площадке продажи
  minPrice: string; // диапазон цены покупки, USD
  maxPrice: string;
  fav: boolean;
  sort: SpreadSort;
  dir: "asc" | "desc";
  page: number;
};

type RawParams = Record<string, string | string[] | undefined>;
const str = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export function parseSpreadFilters(sp: RawParams): SpreadFilters {
  const sort = SORT_KEYS.includes(str(sp.sort) as SpreadSort)
    ? (str(sp.sort) as SpreadSort)
    : "profitPct";
  return {
    q: str(sp.q).slice(0, 100),
    minProfit: str(sp.minProfit).slice(0, 12),
    minLiq: str(sp.minLiq).slice(0, 12),
    minPrice: str(sp.minPrice).slice(0, 12),
    maxPrice: str(sp.maxPrice).slice(0, 12),
    fav: str(sp.fav) === "1",
    sort,
    dir: str(sp.dir) === "asc" ? "asc" : "desc",
    page: Math.max(1, parseInt(str(sp.page), 10) || 1),
  };
}

export function buildSpreadQuery(
  f: SpreadFilters,
  overrides: Partial<SpreadFilters> = {},
): string {
  const m = { ...f, ...overrides };
  const p = new URLSearchParams();
  if (m.q) p.set("q", m.q);
  if (m.minProfit) p.set("minProfit", m.minProfit);
  if (m.minLiq) p.set("minLiq", m.minLiq);
  if (m.minPrice) p.set("minPrice", m.minPrice);
  if (m.maxPrice) p.set("maxPrice", m.maxPrice);
  if (m.fav) p.set("fav", "1");
  if (m.sort !== "profitPct") p.set("sort", m.sort);
  if (m.dir !== "desc") p.set("dir", m.dir);
  if (m.page > 1) p.set("page", String(m.page));
  const s = p.toString();
  return s ? `?${s}` : "";
}

export type SpreadRow = {
  marketHashName: string;
  slug: string | null;
  image: string | null;
  /** Оружие у скинов; у прочего пусто — вид берётся из kind. */
  titleTop: string;
  kind: string;
  titleMain: string;
  buySlug: string;
  buyTitle: string;
  buyPrice: number;
  sellSlug: string;
  sellTitle: string;
  sellPrice: number;
  profit: number;
  profitPct: number;
  liquidity: number | null; // продаж/30д на площадке продажи
  favorite: boolean;
};

export type SpreadsResult = {
  rows: SpreadRow[];
  total: number;
  page: number;
  pageCount: number;
  /** Сколько предметов вообще торгуется больше чем на одной площадке. */
  matched: number;
};
