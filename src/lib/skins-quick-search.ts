// Быстрый поиск по каталогу для строки в шапке. В отличие от /api/skins
// (весь индекс ~460 КБ для автокомплита в форме сделки) отдаёт только десяток
// совпадений и живёт в публичной зоне: страницы предметов и так открыты.
import "server-only";
import { prisma } from "@/lib/prisma";

export type QuickHit = {
  slug: string;
  marketHashName: string;
  title: string; // название без оружия: «Redline (Field-Tested)»
  weapon: string | null;
  image: string | null;
  price: number | null; // минимальная цена по площадкам, USD
};

export const MIN_QUERY = 2;
export const MAX_HITS = 10;

/** Первая буква в верхний регистр: LIKE в SQLite не складывает кириллицу. */
function capitalize(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

export async function quickSearchSkins(raw: string): Promise<QuickHit[]> {
  const q = raw.trim().slice(0, 60);
  if (q.length < MIN_QUERY) return [];

  // Ищем по словам, а не по строке целиком: «ak-47 blood» не встречается в
  // «AK-47 | Bloodsport (Minimal Wear)» подряд из-за разделителя « | ».
  // Каждое слово должно найтись хоть где-то — в имени, русском названии
  // скина или русском названии оружия.
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
      marketHashName: true,
      kind: true,
      weapon: true,
      skinName: true,
      stickerName: true,
      wear: true,
      stattrak: true,
      souvenir: true,
      image: true,
    },
    // Короткие имена вперёд: «AK-47 | Redline (…)» полезнее, чем сувенирный
    // вариант с длинным префиксом.
    orderBy: [{ marketHashName: "asc" }],
    take: 60,
  });

  // Цены тянем по всем кандидатам, а не по финальной десятке: предмет без цен
  // ведёт на пустую страницу, поэтому такие уходят в конец выдачи.
  const prices = new Map<string, number>();
  if (items.length) {
    const rows = await prisma.priceQuote.groupBy({
      by: ["marketHashName"],
      where: { marketHashName: { in: items.map((r) => r.marketHashName) } },
      _min: { priceMin: true },
    });
    for (const r of rows) {
      const v = r._min.priceMin == null ? null : Number(r._min.priceMin);
      if (v != null) prices.set(r.marketHashName, v);
    }
  }

  const ranked = items
    .map((it) => {
      const name = it.marketHashName.toLowerCase();
      // Чем раньше в имени встретилось первое слово и чем короче само имя,
      // тем выше: «AK-47 | Redline (…)» полезнее сувенирного варианта.
      const first = name.indexOf(tokens[0].toLowerCase());
      const noPrice = prices.has(it.marketHashName) ? 0 : 1000;
      return { it, score: noPrice + (first < 0 ? 999 : first) + name.length / 1000 };
    })
    .sort((a, b) => a.score - b.score)
    .slice(0, MAX_HITS)
    .map(({ it }) => it);

  return ranked.map((it) => {
    const base = it.skinName ?? it.stickerName ?? it.marketHashName;
    const suffix = it.wear ? ` (${it.wear})` : "";
    const marks = [it.stattrak && "StatTrak™", it.souvenir && "Souvenir"]
      .filter(Boolean)
      .join(" ");
    return {
      slug: it.slug,
      marketHashName: it.marketHashName,
      title: [marks, `${base}${suffix}`].filter(Boolean).join(" "),
      weapon: it.weapon,
      image: it.image,
      price: prices.get(it.marketHashName) ?? null,
    };
  });
}
