// Общая логика поиска и сборки market_hash_name.
// Используется и на клиенте (автокомплит, live-превью), и на сервере.
import fuzzysort from "fuzzysort";

// Виды предметов каталога. skin/sticker имеют варианты (износ/финиш),
// остальные — одиночные (как агент): один market_hash_name без вариантов.
export type ItemKind =
  | "skin"
  | "sticker"
  | "agent"
  | "case"
  | "capsule"
  | "container"
  | "keychain"
  | "patch"
  | "graffiti"
  | "music_kit"
  | "collectible";

// Одиночные виды (без вариантов) — ведут себя как агент.
export const SINGLE_VARIANT_KINDS: ItemKind[] = [
  "agent", "case", "capsule", "container", "keychain",
  "patch", "graffiti", "music_kit", "collectible",
];

// Семейство каталога (скин или стикер) для автокомплита.
export type SkinFamily = {
  kind: ItemKind;
  f: string; // familyId
  label: string; // отображаемое имя («AK-47 | Redline» / «s1mple | MLG Columbus 2016»)
  r: string | null; // русский алиас (у скинов)
  img: string | null; // картинка (CDN Steam)
  // --- скины ---
  w: string | null; // weapon
  s: string | null; // skinName (pattern)
  star: boolean; // ★ (ножи/перчатки)
  wears: string[]; // износы обычного варианта (FN…BS)
  stWears: string[]; // износы StatTrak-варианта
  svWears: string[]; // износы Souvenir-варианта
  st: boolean; // существует StatTrak-вариант
  sv: boolean; // существует Souvenir-вариант
  // --- стикеры ---
  finishes: string[]; // доступные финиши (Paper/Holo/Foil/…)
  stickerType: string | null; // Autograph / Team / Event / Other
};

export const WEAR_ORDER = [
  "Factory New",
  "Minimal Wear",
  "Field-Tested",
  "Well-Worn",
  "Battle-Scarred",
] as const;

export const FINISH_ORDER = [
  "Paper",
  "Glitter",
  "Holo",
  "Foil",
  "Gold",
  "Lenticular",
  "Embroidered",
] as const;

/** Собрать market_hash_name в формате Steam из атрибутов. */
export function buildMarketHashName(a: {
  star?: boolean;
  stattrak?: boolean;
  souvenir?: boolean;
  weapon: string;
  skinName?: string | null;
  wear?: string | null;
}): string {
  const prefix =
    (a.star ? "★ " : "") +
    (a.stattrak ? "StatTrak™ " : a.souvenir ? "Souvenir " : "");
  const body = a.weapon + (a.skinName ? ` | ${a.skinName}` : "");
  const suffix = a.wear ? ` (${a.wear})` : "";
  return prefix + body + suffix;
}

/**
 * Миниатюра картинки Steam CDN: суффикс размера отдаёт уменьшенную версию
 * (напр. 96×96 ≈ 7 КБ вместо ~70 КБ оригинала). 96 — 2× от размера показа
 * (48px), чтобы не мылилось на retina.
 */
export function skinThumb(url: string | null, size = 96): string | undefined {
  return url ? `${url}/${size}fx${size}f` : undefined;
}

/** Нормализация: lower case, убрать ™ | ( ) и прочие разделители. */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[™|()★–—\-_/.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export type IndexedFamily = {
  fam: SkinFamily;
  _p: Fuzzysort.Prepared;
  len: number;
};

/** Предподготовка семейств (haystack: имя + рус. алиас). */
export function indexFamilies(families: SkinFamily[]): IndexedFamily[] {
  return families.map((f) => ({
    fam: f,
    _p: fuzzysort.prepare(normalize([f.label, f.r ?? ""].join(" "))),
    len: f.label.length,
  }));
}

/**
 * Нечёткий поиск (fuzzysort), устойчивый к опечаткам и порядку слов:
 * запрос разбивается на токены, каждый ищется отдельно, семейство проходит
 * только если найдены все токены; итоговый ранг — сумма оценок токенов.
 */
export function searchFamilies(
  indexed: IndexedFamily[],
  query: string,
  limit = 10,
): SkinFamily[] {
  const tokens = normalize(query).split(" ").filter(Boolean);
  if (tokens.length === 0) return [];

  let acc: Map<IndexedFamily, number> | null = null;
  for (const t of tokens) {
    const res = fuzzysort.go(t, indexed, {
      key: "_p",
      threshold: 0.2,
      limit: 2000,
    });
    if (acc === null) {
      acc = new Map();
      for (const r of res) acc.set(r.obj, r.score);
    } else {
      const scores = new Map<IndexedFamily, number>();
      for (const r of res) scores.set(r.obj, r.score);
      const next = new Map<IndexedFamily, number>();
      for (const [obj, sum] of acc) {
        const s = scores.get(obj);
        if (s !== undefined) next.set(obj, sum + s);
      }
      acc = next;
    }
    if (acc.size === 0) return [];
  }

  return [...acc!.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].len - b[0].len)
    .slice(0, limit)
    .map(([obj]) => obj.fam);
}
