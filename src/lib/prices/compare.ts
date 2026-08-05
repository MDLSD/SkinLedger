// Параметры таблицы сравнения (живут в URL) + типы результата. Чистый модуль
// без prisma — импортируется и с клиента (тулбар), и с сервера. Сама выборка из
// БД — в compare-load.ts (серверный).

export const PAGE_SIZE = 50;

// Какое поле котировки сравнивать на обеих площадках. field: null — тип цены
// есть в интерфейсе, но данных под него источник пока не отдаёт (в списке такой
// пункт неактивен с пометкой «Недоступно»).
// `value` — и значение в URL, и ключ перевода подписи (неймспейс prices.type).
export const PRICE_TYPES = [
  { value: "min", field: "priceMin" },
  { value: "minHold", field: null },
  { value: "minNoHold", field: null },
  { value: "avg30", field: "priceAvg30" },
  { value: "median30", field: "priceMedian30" },
  { value: "corridor50_7", field: null },
  { value: "corridor70_30", field: null },
  { value: "order", field: "priceOrder" },
] as const;
export type PriceType = (typeof PRICE_TYPES)[number]["value"];
export type PriceField = "priceMin" | "priceOrder" | "priceAvg30" | "priceMedian30";
export const PRICE_FIELD: Record<PriceType, PriceField | null> = {
  min: "priceMin",
  minHold: null,
  minNoHold: null,
  avg30: "priceAvg30",
  median30: "priceMedian30",
  corridor50_7: null,
  corridor70_30: null,
  order: "priceOrder",
};

// Только ключи: подписи колонок задаёт страница из переводов.
export const SORT_COLUMNS = ["name", "buy", "sell", "profit", "profitPct", "liq"] as const;
export type SortKey = (typeof SORT_COLUMNS)[number];
const SORT_KEYS = SORT_COLUMNS as readonly SortKey[];

export type PriceFilters = {
  buy: string; // slug площадки покупки
  sell: string; // slug площадки продажи
  buyType: PriceType; // какое поле цены брать на площадке покупки
  sellType: PriceType; // …и на площадке продажи
  q: string; // поиск по market_hash_name
  // Диапазоны — строки как пришли из URL. Цена в USD, количество — число
  // предложений на площадке. Симметрично для обеих сторон связки.
  buyMinPrice: string;
  buyMaxPrice: string;
  buyMinQty: string;
  buyMaxQty: string;
  sellMinPrice: string;
  sellMaxPrice: string;
  sellMinQty: string;
  sellMaxQty: string;
  minProfit: string; // минимальная маржа, %
  minLiq: string; // минимум продаж/30д на площадке продажи
  /** Показывать только избранное. Чёрный список скрывается всегда. */
  fav: boolean;
  sort: SortKey;
  dir: "asc" | "desc";
  page: number;
  /**
   * Активный шаблон профиля (id). Пока он выбран, правки фильтров пишутся
   * в него; выход — переключением на «Default» или другой шаблон.
   */
  profile: string;
};

/** Поля-диапазоны: одинаковый набор для покупки и продажи. */
export const RANGE_KEYS = [
  "buyMinPrice",
  "buyMaxPrice",
  "buyMinQty",
  "buyMaxQty",
  "sellMinPrice",
  "sellMaxPrice",
  "sellMinQty",
  "sellMaxQty",
] as const;

/** Значения по умолчанию — от них считается «фильтры не тронуты». */
export const EMPTY_RANGES: Record<(typeof RANGE_KEYS)[number], string> = {
  buyMinPrice: "",
  buyMaxPrice: "",
  buyMinQty: "",
  buyMaxQty: "",
  sellMinPrice: "",
  sellMaxPrice: "",
  sellMinQty: "",
  sellMaxQty: "",
};

/** Строка настроек без ссылки на шаблон — именно она в шаблоне и хранится. */
export function profileQuery(f: PriceFilters): string {
  // fav — режим просмотра, а не настройка: в шаблон он не сохраняется.
  return buildPriceQuery(f, { profile: "", fav: false });
}

/** Обмен сторонами: площадка, тип цены и все диапазоны. */
export function swapSides(f: PriceFilters): Partial<PriceFilters> {
  return {
    buy: f.sell,
    sell: f.buy,
    buyType: f.sellType,
    sellType: f.buyType,
    buyMinPrice: f.sellMinPrice,
    buyMaxPrice: f.sellMaxPrice,
    buyMinQty: f.sellMinQty,
    buyMaxQty: f.sellMaxQty,
    sellMinPrice: f.buyMinPrice,
    sellMaxPrice: f.buyMaxPrice,
    sellMinQty: f.buyMinQty,
    sellMaxQty: f.buyMaxQty,
  };
}

type RawParams = Record<string, string | string[] | undefined>;
const str = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export const DEFAULT_BUY = "buff163";
export const DEFAULT_SELL = "steam";

// Тип без данных выбрать нельзя даже через URL — иначе таблица окажется пустой.
const parseType = (v: string): PriceType => {
  const t = PRICE_TYPES.find((t) => t.value === v);
  return t && t.field ? (t.value as PriceType) : "min";
};

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
    buyMinPrice: str(sp.buyMinPrice).slice(0, 12),
    buyMaxPrice: str(sp.buyMaxPrice).slice(0, 12),
    buyMinQty: str(sp.buyMinQty).slice(0, 12),
    buyMaxQty: str(sp.buyMaxQty).slice(0, 12),
    sellMinPrice: str(sp.sellMinPrice).slice(0, 12),
    sellMaxPrice: str(sp.sellMaxPrice).slice(0, 12),
    sellMinQty: str(sp.sellMinQty).slice(0, 12),
    sellMaxQty: str(sp.sellMaxQty).slice(0, 12),
    minProfit: str(sp.minProfit).slice(0, 12),
    minLiq: str(sp.minLiq).slice(0, 12),
    fav: str(sp.fav) === "1",
    sort,
    dir,
    page,
    profile: str(sp.profile).slice(0, 40),
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
  for (const k of RANGE_KEYS) if (m[k]) p.set(k, m[k]);
  if (m.minProfit) p.set("minProfit", m.minProfit);
  if (m.minLiq) p.set("minLiq", m.minLiq);
  if (m.fav) p.set("fav", "1");
  if (m.sort !== "profitPct") p.set("sort", m.sort);
  if (m.dir !== "desc") p.set("dir", m.dir);
  if (m.page > 1) p.set("page", String(m.page));
  // profile идёт последним и в сам шаблон не сохраняется (см. queryOf).
  if (m.profile) p.set("profile", m.profile);
  const s = p.toString();
  return s ? `?${s}` : "";
}

export type ComparisonRow = {
  marketHashName: string;
  slug: string | null; // ЧПУ публичной страницы предмета
  /** «favorite» / «blocked» / null — состояние в списках пользователя. */
  watch: "favorite" | "blocked" | null;
  image: string | null;
  // Две строки названия, как в референсе: «AK-47» сверху, «Elite Build
  // (Battle-Scarred)» снизу. Для не-скинов сверху вид предмета.
  titleTop: string;
  titleMain: string;
  stattrak: boolean;
  souvenir: boolean;
  buyPrice: number;
  sellPrice: number;
  buyOffers: number | null; // предложений на площадке покупки
  sellOffers: number | null;
  buyFetchedAt: Date;
  sellFetchedAt: Date;
  buySales: number | null; // продаж/30д на площадке покупки
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
  now: number; // отсечка времени выборки — от неё считается «Обновлено»
};
