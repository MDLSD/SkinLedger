// Быстрый поиск по каталогу для строки в шапке. В отличие от /api/skins
// (весь индекс ~460 КБ для автокомплита в форме сделки) отдаёт только десяток
// совпадений и живёт в публичной зоне: страницы предметов и так открыты.
//
// Выдача сгруппирована по семейству: один скин — одна строка с диапазоном цен
// по всем его качествам, а не по строке на каждый износ.
import "server-only";
import { prisma } from "@/lib/prisma";

export type QuickHit = {
  /** Куда вести: вариант с минимальной ценой, иначе первый по алфавиту. */
  slug: string;
  title: string; // «Dragon Lore» / «Dragon Lore (Foil)»
  weapon: string | null;
  image: string | null;
  low: number | null; // минимальная цена среди вариантов, USD
  high: number | null; // максимальная
  variants: number; // сколько качеств/вариантов в семействе
};

export const MIN_QUERY = 2;
export const MAX_HITS = 8;

/** Первая буква в верхний регистр: LIKE в SQLite не складывает кириллицу. */
function capitalize(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

export async function quickSearchSkins(raw: string): Promise<QuickHit[]> {
  const q = raw.trim().slice(0, 60);
  if (q.length < MIN_QUERY) return [];

  // Ищем по словам, а не по строке целиком: «ak-47 blood» не встречается в
  // «AK-47 | Bloodsport (Minimal Wear)» подряд из-за разделителя « | ».
  const tokens = q.split(/\s+/).filter(Boolean).slice(0, 6);

  const items = await prisma.marketItem.findMany({
    where: {
      AND: tokens.map((t) => ({
        OR: [
          { marketHashName: { contains: t } },
          { ruSkinName: { contains: capitalize(t) } },
          { ruWeapon: { contains: capitalize(t) } },
        ],
      })),
    },
    select: {
      slug: true,
      familyId: true,
      marketHashName: true,
      kind: true,
      weapon: true,
      skinName: true,
      stickerName: true,
      finish: true,
      image: true,
    },
    orderBy: [{ marketHashName: "asc" }],
    // Берём с запасом: варианты одного скина схлопнутся в одну строку.
    take: 200,
  });
  if (!items.length) return [];

  const prices = new Map<string, number>();
  const rows = await prisma.priceQuote.groupBy({
    by: ["marketHashName"],
    where: { marketHashName: { in: items.map((r) => r.marketHashName) } },
    _min: { priceMin: true },
  });
  for (const r of rows) {
    const v = r._min.priceMin == null ? null : Number(r._min.priceMin);
    if (v != null) prices.set(r.marketHashName, v);
  }

  type Group = {
    title: string;
    weapon: string | null;
    image: string | null;
    slug: string;
    cheapest: number | null;
    low: number | null;
    high: number | null;
    variants: number;
    pos: number; // где в названии встретилось первое слово запроса
  };

  const needle = tokens[0].toLowerCase();
  const groups = new Map<string, Group>();

  for (const it of items) {
    // Стикеры различаются финишем, и он часть названия: «Dragon Lore (Foil)».
    const base =
      it.kind === "skin"
        ? (it.skinName ?? it.marketHashName)
        : (it.stickerName ?? it.marketHashName);
    const title = it.kind === "skin" || !it.finish ? base : `${base} (${it.finish})`;
    const key = `${it.familyId}|${title}`;
    const price = prices.get(it.marketHashName) ?? null;
    const pos = it.marketHashName.toLowerCase().indexOf(needle);

    const g = groups.get(key);
    if (!g) {
      groups.set(key, {
        title,
        weapon: it.weapon,
        image: it.image,
        slug: it.slug,
        cheapest: price,
        low: price,
        high: price,
        variants: 1,
        pos: pos < 0 ? 999 : pos,
      });
      continue;
    }
    g.variants += 1;
    if (!g.image && it.image) g.image = it.image;
    if (price != null) {
      g.low = g.low == null ? price : Math.min(g.low, price);
      g.high = g.high == null ? price : Math.max(g.high, price);
      // Ведём на самый дешёвый вариант: у него точно есть цены на странице.
      if (g.cheapest == null || price < g.cheapest) {
        g.cheapest = price;
        g.slug = it.slug;
      }
    }
    if (pos >= 0) g.pos = Math.min(g.pos, pos);
  }

  return [...groups.values()]
    .sort((a, b) => {
      // Сначала то, по чему есть цены: остальное ведёт на пустую страницу.
      const priced = (a.low == null ? 1 : 0) - (b.low == null ? 1 : 0);
      if (priced) return priced;
      if (a.pos !== b.pos) return a.pos - b.pos;
      return a.title.length - b.title.length;
    })
    .slice(0, MAX_HITS)
    .map((g) => ({
      slug: g.slug,
      title: g.title,
      weapon: g.weapon,
      image: g.image,
      low: g.low,
      high: g.high,
      variants: g.variants,
    }));
}
