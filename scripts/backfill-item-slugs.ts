/**
 * Разовый бэкфилл MarketItem под публичные SEO-страницы (ТЗ 2.2 и 7.2):
 *  - slug: настоящий ЧПУ вместо заглушки, проставленной миграцией
 *    market_item_seo_fields (там в slug временно лёг market_hash_name);
 *  - weapon / collection / rarity: из каталожного датасета ByMykel/CSGO-API
 *    по market_hash_name. Предмета нет в датасете → поля остаются null.
 *
 * Идемпотентен: уже сгенерированные slug не трогает (ЧПУ не должен меняться —
 * иначе ломаются проиндексированные ссылки), меняет только те записи, где
 * значение реально отличается. Повторный запуск безопасен.
 *
 * Запуск: npm run backfill:item-slugs
 * Отладка с локальными файлами: SKINS_JSON=… SKINS_GROUPED_JSON=… STICKERS_JSON=… …
 */
import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";
import { slugFor, uniqueSlug } from "../src/lib/slug";
import { buildMetaMap, type MetaSkin, type MetaSkinFamily, type MetaSource } from "./lib/catalog-meta";

const BASE = "https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en";
const SOURCES: { url: string; env: string }[] = [
  { url: `${BASE}/skins_not_grouped.json`, env: "SKINS_JSON" },
  { url: `${BASE}/skins.json`, env: "SKINS_GROUPED_JSON" },
  { url: `${BASE}/stickers.json`, env: "STICKERS_JSON" },
  { url: `${BASE}/agents.json`, env: "AGENTS_JSON" },
  { url: `${BASE}/crates.json`, env: "CRATES_JSON" },
  { url: `${BASE}/keychains.json`, env: "KEYCHAINS_JSON" },
  { url: `${BASE}/patches.json`, env: "PATCHES_JSON" },
  { url: `${BASE}/graffiti.json`, env: "GRAFFITI_JSON" },
  { url: `${BASE}/music_kits.json`, env: "MUSIC_KITS_JSON" },
  { url: `${BASE}/collectibles.json`, env: "COLLECTIBLES_JSON" },
];

async function loadJson<T>(url: string, envOverride: string): Promise<T> {
  const local = process.env[envOverride];
  if (local) {
    const { readFile } = await import("node:fs/promises");
    console.log(`  ← локальный файл ${local}`);
    return JSON.parse(await readFile(local, "utf8")) as T;
  }
  console.log(`  ← ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return (await res.json()) as T;
}

async function main() {
  const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });

  console.log("Загрузка каталожного датасета…");
  const [skins, families, ...others] = (await Promise.all(
    SOURCES.map((s) => loadJson<unknown[]>(s.url, s.env)),
  )) as [MetaSkin[], MetaSkinFamily[], ...MetaSource[][]];
  const meta = buildMetaMap(skins, families, others);
  console.log(`  предметов с метаданными: ${meta.size}`);

  // Порядок фиксированный — бэкфилл на одинаковых данных даёт одинаковые slug.
  const items = await prisma.marketItem.findMany({
    orderBy: { marketHashName: "asc" },
    select: {
      id: true,
      marketHashName: true,
      slug: true,
      weapon: true,
      collection: true,
      rarity: true,
    },
  });
  console.log(`В каталоге: ${items.length}`);

  // Заглушка миграции — slug, равный market_hash_name. Всё остальное считаем
  // уже выданным ЧПУ и не переписываем.
  const needsSlug = items.filter((i) => i.slug === i.marketHashName);
  const taken = new Set(items.filter((i) => i.slug !== i.marketHashName).map((i) => i.slug));

  type Patch = { id: string; data: Record<string, string | null> };
  const patches: Patch[] = [];
  let slugged = 0;
  let enriched = 0;
  let noMeta = 0;

  const needsSlugIds = new Set(needsSlug.map((i) => i.id));
  for (const it of items) {
    const data: Record<string, string | null> = {};

    if (needsSlugIds.has(it.id)) {
      data.slug = uniqueSlug(slugFor(it.marketHashName), taken);
      slugged++;
    }

    const m = meta.get(it.marketHashName);
    if (!m) noMeta++;
    else {
      // weapon не затираем: у скинов он уже заполнен импортом.
      if (m.weapon && m.weapon !== it.weapon) data.weapon = m.weapon;
      if ((m.collection ?? null) !== it.collection) data.collection = m.collection;
      if ((m.rarity ?? null) !== it.rarity) data.rarity = m.rarity;
      if ("weapon" in data || "collection" in data || "rarity" in data) enriched++;
    }

    if (Object.keys(data).length) patches.push({ id: it.id, data });
  }

  const CHUNK = 500;
  for (let i = 0; i < patches.length; i += CHUNK) {
    const chunk = patches.slice(i, i + CHUNK);
    await prisma.$transaction(
      chunk.map((p) => prisma.marketItem.update({ where: { id: p.id }, data: p.data })),
    );
    process.stdout.write(`\r  обновлено ${Math.min(i + CHUNK, patches.length)}/${patches.length}`);
  }
  if (patches.length) process.stdout.write("\n");

  const left = await prisma.marketItem.count({ where: { slug: { equals: "" } } });
  console.log(
    `Готово. Сгенерировано slug: ${slugged}, дополнено метаданными: ${enriched}, ` +
      `нет в датасете: ${noMeta}, записей без slug: ${left}.`,
  );

  const sample = await prisma.marketItem.findMany({
    where: { marketHashName: { in: ["AK-47 | Redline (Field-Tested)", "★ Karambit | Doppler (Factory New)"] } },
    select: { marketHashName: true, slug: true, weapon: true, collection: true, rarity: true },
  });
  for (const s of sample) console.log("  ", s.marketHashName, "→", s.slug, JSON.stringify(s));

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
