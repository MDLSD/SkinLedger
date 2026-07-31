// Данные публичной страницы предмета (ТЗ 3.4): своды цен по всем площадкам,
// история для графика, варианты качества и лучшая связка по прибыли.
// Всё читается из своей БД — к агрегатору страница не ходит (ТЗ 1).
import "server-only";
import { prisma } from "@/lib/prisma";
import { computeProfit, type SourceFees } from "./profit";

export type SourceOffer = {
  slug: string;
  title: string;
  price: number; // минимальный листинг, USD
  order: number | null; // цена ордера покупки
  offers: number | null;
  sales30d: number | null;
  fetchedAt: Date;
  fees: SourceFees;
};

export type BestPair = {
  buy: SourceOffer;
  sell: SourceOffer;
  profit: number;
  profitPct: number;
};

export type Variant = {
  slug: string;
  marketHashName: string;
  label: string; // «Factory New», «StatTrak™ Minimal Wear» …
  price: number | null;
  current: boolean;
};

/** Точка графика: время + цена по каждой площадке (null — нет котировки). */
export type ChartPoint = { t: number } & Record<string, number | null>;

export type ItemPageData = {
  item: {
    marketHashName: string;
    slug: string;
    titleTop: string; // оружие или вид предмета
    titleMain: string; // название со износом
    image: string | null;
    weapon: string | null;
    collection: string | null;
    rarity: string | null;
    wear: string | null;
    stattrak: boolean;
    souvenir: boolean;
  };
  offers: SourceOffer[];
  /** Рыночная цена — медиана по площадкам; low — минимум; avg7 — среднее за 7 дней. */
  market: { median: number | null; low: number | null; avg7: number | null };
  totals: { offers: number | null; sales30d: number | null };
  /** Изменение медианной цены за 24ч / 7д / 30д, в процентах. */
  changes: { d1: number | null; d7: number | null; d30: number | null };
  best: BestPair | null;
  variants: Variant[];
  /** Вся история сразу: пресеты периода переключаются на клиенте без запроса. */
  chart: { points: ChartPoint[]; sources: { slug: string; title: string }[] };
  /** Тонкая страница (ТЗ 7.6): цены меньше чем на двух площадках → noindex. */
  thin: boolean;
  /** Момент выборки: от него считаются периоды на графике (в рендере Date.now нельзя). */
  now: number;
};

const KIND_LABEL: Record<string, string> = {
  sticker: "Стикер",
  agent: "Агент",
  case: "Кейс",
  capsule: "Капсула",
  container: "Контейнер",
  keychain: "Брелок",
  patch: "Патч",
  graffiti: "Граффити",
  music_kit: "Музыкальный набор",
  collectible: "Коллекционный предмет",
};

const num = (v: unknown): number | null => (v == null ? null : Number(v));

function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Подпись варианта: то, чем он отличается от собратьев по семейству. */
function variantLabel(v: {
  wear: string | null;
  finish: string | null;
  stattrak: boolean;
  souvenir: boolean;
}): string {
  const parts = [];
  if (v.stattrak) parts.push("StatTrak™");
  if (v.souvenir) parts.push("Souvenir");
  parts.push(v.wear ?? v.finish ?? "Без варианта");
  return parts.join(" ");
}

/** Максимум линий на графике — ТЗ 3.4. */
export const MAX_CHART_SOURCES = 5;

export async function loadItemPage(slug: string): Promise<ItemPageData | null> {
  const now = Date.now();
  const item = await prisma.marketItem.findUnique({
    where: { slug },
    select: {
      marketHashName: true,
      slug: true,
      kind: true,
      weapon: true,
      skinName: true,
      stickerName: true,
      wear: true,
      finish: true,
      stattrak: true,
      souvenir: true,
      collection: true,
      rarity: true,
      image: true,
      familyId: true,
    },
  });
  if (!item) return null;

  const [quotes, sources, history, family] = await Promise.all([
    prisma.priceQuote.findMany({
      where: { marketHashName: item.marketHashName },
      select: {
        sourceSlug: true,
        priceMin: true,
        priceOrder: true,
        offersCount: true,
        sales30d: true,
        fetchedAt: true,
      },
    }),
    prisma.marketSource.findMany({
      where: { isActive: true },
      select: {
        slug: true,
        title: true,
        buyFeePct: true,
        sellFeePct: true,
        withdrawFeePct: true,
      },
    }),
    prisma.priceHistory.findMany({
      where: { marketHashName: item.marketHashName },
      orderBy: { ts: "asc" },
      select: { sourceSlug: true, price: true, ts: true },
    }),
    prisma.marketItem.findMany({
      where: { familyId: item.familyId },
      select: {
        slug: true,
        marketHashName: true,
        wear: true,
        finish: true,
        stattrak: true,
        souvenir: true,
      },
      orderBy: { marketHashName: "asc" },
      take: 40,
    }),
  ]);

  const sourceBySlug = new Map(sources.map((s) => [s.slug, s]));

  const offers: SourceOffer[] = quotes
    .flatMap((q) => {
      const src = sourceBySlug.get(q.sourceSlug);
      const price = num(q.priceMin);
      if (!src || price == null) return [];
      return [
        {
          slug: src.slug,
          title: src.title,
          price,
          order: num(q.priceOrder),
          offers: q.offersCount ?? null,
          sales30d: q.sales30d ?? null,
          fetchedAt: q.fetchedAt,
          fees: {
            buyFeePct: Number(src.buyFeePct),
            sellFeePct: Number(src.sellFeePct),
            withdrawFeePct: Number(src.withdrawFeePct),
          },
        },
      ];
    })
    .sort((a, b) => a.price - b.price);

  const prices = offers.map((o) => o.price);
  const marketMedian = median(prices);

  // Лучшая связка: перебор всех упорядоченных пар площадок с комиссиями.
  let best: BestPair | null = null;
  for (const buy of offers) {
    for (const sell of offers) {
      if (buy.slug === sell.slug) continue;
      const { profit, profitPct } = computeProfit(buy.price, sell.price, buy.fees, sell.fees);
      if (!best || profit > best.profit) best = { buy, sell, profit, profitPct };
    }
  }

  // График: до MAX_CHART_SOURCES площадок, приоритет — те, что дешевле (их и
  // сравнивают). История сводится к общей временной сетке.
  const chartSources = offers.slice(0, MAX_CHART_SOURCES).map((o) => ({
    slug: o.slug,
    title: o.title,
  }));
  const chartSlugs = new Set(chartSources.map((s) => s.slug));
  const byTime = new Map<number, ChartPoint>();
  for (const h of history) {
    if (!chartSlugs.has(h.sourceSlug)) continue;
    const t = h.ts.getTime();
    let point = byTime.get(t);
    if (!point) {
      point = { t };
      for (const s of chartSources) point[s.slug] = null;
      byTime.set(t, point);
    }
    point[h.sourceSlug] = Number(h.price);
  }
  const points = [...byTime.values()].sort((a, b) => a.t - b.t);

  // Статистика за период и изменение цены: считаем по медиане площадок на
  // каждый момент, чтобы одна площадка не перекашивала картину.
  const marketSeries = points.map((p) => {
    const vals = chartSources
      .map((s) => p[s.slug])
      .filter((v): v is number => typeof v === "number");
    return { t: p.t, v: median(vals) };
  });
  const changeSince = (ms: number): number | null => {
    if (marketMedian == null) return null;
    const cutoff = now - ms;
    // Ближайшая точка не позже cutoff; если истории такой глубины нет — null.
    let prev: number | null = null;
    for (const p of marketSeries) {
      if (p.t <= cutoff && p.v != null) prev = p.v;
    }
    if (prev == null || prev === 0) return null;
    return ((marketMedian - prev) / prev) * 100;
  };

  const avg7 = (() => {
    const cutoff = now - 7 * 86400_000;
    const vals = marketSeries
      .filter((p) => p.t >= cutoff && p.v != null)
      .map((p) => p.v as number);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  })();

  const familyPrices = new Map<string, number>();
  if (family.length > 1) {
    const rows = await prisma.priceQuote.groupBy({
      by: ["marketHashName"],
      where: { marketHashName: { in: family.map((f) => f.marketHashName) } },
      _min: { priceMin: true },
    });
    for (const r of rows) {
      const v = num(r._min.priceMin);
      if (v != null) familyPrices.set(r.marketHashName, v);
    }
  }

  const variants: Variant[] = family.map((f) => ({
    slug: f.slug,
    marketHashName: f.marketHashName,
    label: variantLabel(f),
    price: familyPrices.get(f.marketHashName) ?? null,
    current: f.marketHashName === item.marketHashName,
  }));

  const titleMain =
    item.kind === "skin"
      ? [item.skinName, item.wear && `(${item.wear})`].filter(Boolean).join(" ") ||
        item.marketHashName
      : (item.stickerName ?? item.skinName ?? item.marketHashName);

  const sumOrNull = (vals: (number | null)[]) => {
    const nums = vals.filter((v): v is number => v != null);
    return nums.length ? nums.reduce((a, b) => a + b, 0) : null;
  };

  return {
    item: {
      marketHashName: item.marketHashName,
      slug: item.slug,
      titleTop: item.kind === "skin" ? (item.weapon ?? "") : (KIND_LABEL[item.kind] ?? ""),
      titleMain,
      image: item.image,
      weapon: item.weapon,
      collection: item.collection,
      rarity: item.rarity,
      wear: item.wear,
      stattrak: item.stattrak,
      souvenir: item.souvenir,
    },
    offers,
    market: { median: marketMedian, low: prices.length ? prices[0] : null, avg7 },
    totals: {
      offers: sumOrNull(offers.map((o) => o.offers)),
      sales30d: sumOrNull(offers.map((o) => o.sales30d)),
    },
    changes: {
      d1: changeSince(86400_000),
      d7: changeSince(7 * 86400_000),
      d30: changeSince(30 * 86400_000),
    },
    best,
    variants,
    chart: { points, sources: chartSources },
    thin: offers.length < 2,
    now,
  };
}
