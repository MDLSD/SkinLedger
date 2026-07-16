/**
 * Импорт справочника скинов CS2 из ByMykel/CSGO-API.
 *
 * Источники:
 *  - en/skins_not_grouped.json — по строке на торгуемый вариант
 *    (оружие + скин + износ + StatTrak/Souvenir) с market_hash_name.
 *  - csgo_english.json / csgo_russian.json — локализация Valve; русские
 *    названия скинов берём, связывая EN- и RU-токены по общему ключу
 *    (PaintKit_*_Tag), т.к. id пейнткита ≠ id паттерна.
 *
 * Идемпотентность: upsert по market_hash_name (уникален в Steam).
 * Повторный запуск обновляет изменившиеся записи и не создаёт дублей.
 *
 * Запуск: npx tsx scripts/import-skins.ts
 * Для отладки можно подложить локальные файлы: SKINS_JSON=/path/ng_en.json ...
 */
import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";

const NG_URL =
  "https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en/skins_not_grouped.json";
const EN_LANG_URL =
  "https://raw.githubusercontent.com/ByMykel/counter-strike-file-tracker/main/static/csgo_english.json";
const RU_LANG_URL =
  "https://raw.githubusercontent.com/ByMykel/counter-strike-file-tracker/main/static/csgo_russian.json";

type Named = { id?: string; name?: string } | null | undefined;
type NgSkin = {
  id: string;
  skin_id: string;
  market_hash_name: string;
  weapon: Named;
  pattern: Named;
  wear: Named;
  stattrak: boolean;
  souvenir: boolean;
};

async function loadJson<T>(url: string, envOverride?: string): Promise<T> {
  const local = envOverride && process.env[envOverride];
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

/** EN→RU карта названий скинов по токенам PaintKit_*_Tag. */
function buildPatternRuMap(
  enTokens: Record<string, unknown>,
  ruTokens: Record<string, unknown>,
): Map<string, string> {
  const ruByKey = new Map<string, string>();
  for (const k in ruTokens) {
    const v = ruTokens[k];
    if (typeof v === "string") ruByKey.set(k.toLowerCase(), v);
  }
  const map = new Map<string, string>();
  for (const k in enTokens) {
    const key = k.toLowerCase();
    if (!/^paintkit_.*_tag$/.test(key)) continue;
    const en = enTokens[k];
    const ru = ruByKey.get(key);
    if (typeof en === "string" && en && ru) map.set(en.toLowerCase(), ru);
  }
  return map;
}

async function main() {
  const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });

  console.log("Загрузка данных…");
  const [skins, enLang, ruLang] = await Promise.all([
    loadJson<NgSkin[]>(NG_URL, "SKINS_JSON"),
    loadJson<{ lang: { Tokens: Record<string, unknown> } }>(EN_LANG_URL, "EN_LANG_JSON"),
    loadJson<{ lang: { Tokens: Record<string, unknown> } }>(RU_LANG_URL, "RU_LANG_JSON"),
  ]);
  console.log(`  вариантов скинов: ${skins.length}`);

  const patternRu = buildPatternRuMap(enLang.lang.Tokens, ruLang.lang.Tokens);
  console.log(`  русских названий скинов: ${patternRu.size}`);

  // Уже существующие записи: market_hash_name → external_id (для детекта дублей источника).
  const existing = new Map(
    (await prisma.skin.findMany({ select: { marketHashName: true, externalId: true } })).map(
      (s) => [s.marketHashName, s.externalId],
    ),
  );

  let created = 0;
  let updated = 0;
  let skippedDup = 0;
  const seen = new Set<string>();

  // Батчами в транзакциях: upsert по market_hash_name.
  const CHUNK = 500;
  for (let i = 0; i < skins.length; i += CHUNK) {
    const chunk = skins.slice(i, i + CHUNK);
    await prisma.$transaction(
      chunk.flatMap((s) => {
        const mhn = s.market_hash_name;
        // В источнике возможны разные варианты (paint seed) с одинаковым
        // market_hash_name — в справочнике храним один каноничный.
        if (seen.has(mhn)) {
          skippedDup++;
          return [];
        }
        seen.add(mhn);

        const weapon = s.weapon?.name ?? "";
        const skinName = s.pattern?.name ?? null;
        const wear = s.wear?.name ?? null;
        const data = {
          externalId: s.id,
          skinFamilyId: s.skin_id,
          weapon,
          skinName,
          wear,
          stattrak: !!s.stattrak,
          souvenir: !!s.souvenir,
          star: mhn.startsWith("★"),
          marketHashName: mhn,
          ruWeapon: null as string | null, // оружие в RU совпадает с латиницей
          ruSkinName: skinName ? (patternRu.get(skinName.toLowerCase()) ?? null) : null,
        };

        if (existing.has(mhn)) updated++;
        else created++;

        return [
          prisma.skin.upsert({
            where: { marketHashName: mhn },
            create: data,
            update: data,
          }),
        ];
      }),
    );
    process.stdout.write(`\r  обработано ${Math.min(i + CHUNK, skins.length)}/${skins.length}`);
  }
  process.stdout.write("\n");

  const total = await prisma.skin.count();
  console.log(
    `Готово. Создано: ${created}, обновлено: ${updated}, пропущено дублей источника: ${skippedDup}. Всего в справочнике: ${total}.`,
  );
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
