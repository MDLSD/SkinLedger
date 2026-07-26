// Параметры таблицы сравнения (живут в URL) + типы результата. Чистый модуль
// без prisma — импортируется и с клиента (тулбар), и с сервера. Сама выборка из
// БД — в compare-load.ts (серверный).

export const PAGE_SIZE = 50;

// Какое поле котировки сравнивать на обеих площадках.
export const PRICE_TYPES = [
  { value: "min", label: "Минимальная", field: "priceMin" },
  { value: "avg30", label: "Средняя (30д)", field: "priceAvg30" },
  { value: "median30", label: "Медиана (30д)", field: "priceMedian30" },
] as const;
export type PriceType = (typeof PRICE_TYPES)[number]["value"];
export type PriceField = "priceMin" | "priceAvg30" | "priceMedian30";
export const PRICE_FIELD: Record<PriceType, PriceField> = {
  min: "priceMin",
  avg30: "priceAvg30",
  median30: "priceMedian30",
};

export const SORT_COLUMNS = [
  { key: "name", label: "Скин" },
  { key: "buy", label: "Покупка" },
  { key: "sell", label: "Продажа" },
  { key: "profit", label: "Прибыль" },
  { key: "profitPct", label: "Маржа" },
  { key: "liq", label: "Ликвидность" },
] as const;
export type SortKey = (typeof SORT_COLUMNS)[number]["key"];
const SORT_KEYS = SORT_COLUMNS.map((c) => c.key) as SortKey[];

export type PriceFilters = {
  buy: string; // slug площадки покупки
  sell: string; // slug площадки продажи
  buyType: PriceType; // какое поле цены брать на площадке покупки
  sellType: PriceType; // …и на площадке продажи
  q: string; // поиск по market_hash_name
  minPrice: string; // фильтр по цене покупки, USD (строка из URL)
  maxPrice: string;
  minProfit: string; // минимальная маржа, %
  minLiq: string; // минимум продаж/30д на площадке продажи
  sort: SortKey;
  dir: "asc" | "desc";
  page: number;
};

type RawParams = Record<string, string | string[] | undefined>;
const str = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export const DEFAULT_BUY = "buff163";
export const DEFAULT_SELL = "steam";

const parseType = (v: string): PriceType =>
  (PRICE_TYPES.find((t) => t.value === v)?.value ?? "min") as PriceType;

export function parsePriceFilters(sp: RawParams, sourceSlugs: string[]): PriceFilters {
  const pick = (v: string, fallback: string) => (sourceSlugs.includes(v) ? v : fallback);
  const sort = SORT_KEYS.includes(str(sp.sort) as SortKey) ? (str(sp.sort) as SortKey) : "profitPct";
  const dir = str(sp.dir) === "asc" ? "asc" : "desc";
  const page = Math.max(1, parseInt(str(sp.page), 10) || 1);
  return {
    buy: pick(str(sp.buy), sourceSlugs.includes(DEFAULT_BUY) ? DEFAULT_BUY : (sourceSlugs[0] ?? "")),
    sell: pick(
      str(sp.sell),
      sourceSlugs.includes(DEFAULT_SELL) ? DEFAULT_SELL : (sourceSlugs[1] ?? sourceSlugs[0] ?? ""),
    ),
    buyType: parseType(str(sp.buyType)),
    sellType: parseType(str(sp.sellType)),
    q: str(sp.q).slice(0, 100),
    minPrice: str(sp.minPrice).slice(0, 12),
    maxPrice: str(sp.maxPrice).slice(0, 12),
    minProfit: str(sp.minProfit).slice(0, 12),
    minLiq: str(sp.minLiq).slice(0, 12),
    sort,
    dir,
    page,
  };
}

export function buildPriceQuery(f: PriceFilters, overrides: Partial<PriceFilters> = {}): string {
  const m = { ...f, ...overrides };
  const p = new URLSearchParams();
  if (m.buy !== DEFAULT_BUY) p.set("buy", m.buy);
  if (m.sell !== DEFAULT_SELL) p.set("sell", m.sell);
  if (m.buyType !== "min") p.set("buyType", m.buyType);
  if (m.sellType !== "min") p.set("sellType", m.sellType);
  if (m.q) p.set("q", m.q);
  if (m.minPrice) p.set("minPrice", m.minPrice);
  if (m.maxPrice) p.set("maxPrice", m.maxPrice);
  if (m.minProfit) p.set("minProfit", m.minProfit);
  if (m.minLiq) p.set("minLiq", m.minLiq);
  if (m.sort !== "profitPct") p.set("sort", m.sort);
  if (m.dir !== "desc") p.set("dir", m.dir);
  if (m.page > 1) p.set("page", String(m.page));
  const s = p.toString();
  return s ? `?${s}` : "";
}

export type ComparisonRow = {
  marketHashName: string;
  image: string | null;
  buyPrice: number;
  sellPrice: number;
  profit: number;
  profitPct: number;
  liquidity: number | null; // продаж/30д на площадке продажи
};

export type ComparisonResult = {
  rows: ComparisonRow[];
  total: number; // после фильтров, до пагинации
  page: number;
  pageCount: number;
  matched: number; // сколько предметов есть на обеих площадках (до фильтров)
};
