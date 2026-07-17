/**
 * Импорт каталога торгуемых предметов CS2 из ByMykel/CSGO-API.
 *
 * Виды (kind):
 *  - "skin"    — en/skins_not_grouped.json: по строке на вариант
 *    (оружие + скин + износ + StatTrak/Souvenir).
 *  - "sticker" — en/stickers.json: стикеры игроков/команд/турниров/коллабораций;
 *    ось вариантов — финиш (Paper/Holo/Foil/Gold/Glitter/…), уже вшитый в имя.
 *
 * Русские названия скинов берём из локализации Valve, связывая EN/RU-токены
 * по ключу PaintKit_*_Tag. Идемпотентность: upsert по market_hash_name.
 *
 * Запуск: npx tsx scripts/import-catalog.ts
 * Отладка с локальными файлами: SKINS_JSON=… STICKERS_JSON=… EN_LANG_JSON=… RU_LANG_JSON=…
 */
import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";

const NG_URL =
  "https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en/skins_not_grouped.json";
const STICKERS_URL =
  "https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en/stickers.json";
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
  image?: string | null;
};
type Sticker = {
  id: string;
  market_hash_name: string | null;
  type?: string | null;
  effect?: string | null;
  tournament?: Named;
  image?: string | null;
};

// Строка каталога (совпадает с полями MarketItem, кроме id).
type ItemRow = {
  kind: string;
  externalId: string;
  familyId: string;
  weapon: string | null;
  skinName: string | null;
  wear: string | null;
  stattrak: boolean;
  souvenir: boolean;
  star: boolean;
  stickerName: string | null;
  finish: string | null;
  stickerType: string | null;
  tournament: string | null;
  marketHashName: string;
  image: string | null;
  ruWeapon: string | null;
  ruSkinName: string | null;
};

const FINISH_RE = /\s\((Holo|Foil|Gold|Glitter|Lenticular|Embroidered)\)/;

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

function skinRow(s: NgSkin, patternRu: Map<string, string>): ItemRow {
  const mhn = s.market_hash_name;
  const skinName = s.pattern?.name ?? null;
  return {
    kind: "skin",
    externalId: s.id,
    familyId: s.skin_id,
    weapon: s.weapon?.name ?? "",
    skinName,
    wear: s.wear?.name ?? null,
    stattrak: !!s.stattrak,
    souvenir: !!s.souvenir,
    star: mhn.startsWith("★"),
    stickerName: null,
    finish: null,
    stickerType: null,
    tournament: null,
    marketHashName: mhn,
    image: s.image ?? null,
    ruWeapon: null,
    ruSkinName: skinName ? (patternRu.get(skinName.toLowerCase()) ?? null) : null,
  };
}

function stickerRow(s: Sticker): ItemRow | null {
  const mhn = s.market_hash_name;
  if (!mhn) return null; // не торгуется на рынке

  // Финиш: effect "Other"/пусто = базовый (Paper), иначе Holo/Foil/Gold/…
  const finish =
    s.effect && s.effect !== "Other" ? s.effect : "Paper";
  // Семейство = имя без финиша, напр. «Sticker | s1mple (Foil) | …» → «Sticker | s1mple | …».
  const familyName = mhn.replace(FINISH_RE, "");
  const stickerName = familyName.replace(/^Sticker \| /, "");

  return {
    kind: "sticker",
    externalId: s.id,
    familyId: `stk:${familyName}`,
    weapon: null,
    skinName: null,
    wear: null,
    stattrak: false,
    souvenir: false,
    star: false,
    stickerName,
    finish,
    stickerType: s.type ?? null,
    tournament: s.tournament?.name ?? null,
    marketHashName: mhn,
    image: s.image ?? null,
    ruWeapon: null,
    ruSkinName: null, // имена игроков/команд не локализуются
  };
}

async function main() {
  const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });

  console.log("Загрузка данных…");
  const [skins, stickers, enLang, ruLang] = await Promise.all([
    loadJson<NgSkin[]>(NG_URL, "SKINS_JSON"),
    loadJson<Sticker[]>(STICKERS_URL, "STICKERS_JSON"),
    loadJson<{ lang: { Tokens: Record<string, unknown> } }>(EN_LANG_URL, "EN_LANG_JSON"),
    loadJson<{ lang: { Tokens: Record<string, unknown> } }>(RU_LANG_URL, "RU_LANG_JSON"),
  ]);
  console.log(`  вариантов скинов: ${skins.length}, стикеров: ${stickers.length}`);

  const patternRu = buildPatternRuMap(enLang.lang.Tokens, ruLang.lang.Tokens);
  console.log(`  русских названий скинов: ${patternRu.size}`);

  // Собираем все строки, дедуплицируем по market_hash_name.
  const rows: ItemRow[] = [];
  const seen = new Set<string>();
  let skippedDup = 0;
  let skippedNoMhn = 0;
  const push = (r: ItemRow | null) => {
    if (!r) {
      skippedNoMhn++;
      return;
    }
    if (seen.has(r.marketHashName)) {
      skippedDup++;
      return;
    }
    seen.add(r.marketHashName);
    rows.push(r);
  };
  for (const s of skins) push(skinRow(s, patternRu));
  for (const s of stickers) push(stickerRow(s));

  const existing = new Set(
    (await prisma.marketItem.findMany({ select: { marketHashName: true } })).map(
      (m) => m.marketHashName,
    ),
  );
  let created = 0;
  let updated = 0;

  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    await prisma.$transaction(
      chunk.map((data) => {
        if (existing.has(data.marketHashName)) updated++;
        else created++;
        return prisma.marketItem.upsert({
          where: { marketHashName: data.marketHashName },
          create: data,
          update: data,
        });
      }),
    );
    process.stdout.write(`\r  обработано ${Math.min(i + CHUNK, rows.length)}/${rows.length}`);
  }
  process.stdout.write("\n");

  const [total, skinCount, stickerCount] = await Promise.all([
    prisma.marketItem.count(),
    prisma.marketItem.count({ where: { kind: "skin" } }),
    prisma.marketItem.count({ where: { kind: "sticker" } }),
  ]);
  console.log(
    `Готово. Создано: ${created}, обновлено: ${updated}, пропущено (дубли: ${skippedDup}, без имени: ${skippedNoMhn}).`,
  );
  console.log(`  В каталоге: ${total} (скинов: ${skinCount}, стикеров: ${stickerCount}).`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
