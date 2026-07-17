// Общая логика поиска и сборки market_hash_name.
// Используется и на клиенте (автокомплит, live-превью), и на сервере.
import fuzzysort from "fuzzysort";

export type SkinFamily = {
  f: string; // skinFamilyId
  w: string; // weapon
  s: string | null; // skinName (pattern)
  r: string | null; // ruSkinName
  star: boolean; // ★ (ножи/перчатки)
  img: string | null; // картинка (CDN Steam)
  wears: string[]; // износы обычного варианта (FN…BS)
  stWears: string[]; // износы StatTrak-варианта
  svWears: string[]; // износы Souvenir-варианта
  st: boolean; // существует StatTrak-вариант (в т.ч. без износа)
  sv: boolean; // существует Souvenir-вариант
};

export const WEAR_ORDER = [
  "Factory New",
  "Minimal Wear",
  "Field-Tested",
  "Well-Worn",
  "Battle-Scarred",
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

/** Предподготовка семейств (haystack: англ. оружие + скин + рус. скин). */
export function indexFamilies(families: SkinFamily[]): IndexedFamily[] {
  return families.map((f) => ({
    fam: f,
    _p: fuzzysort.prepare(normalize([f.w, f.s ?? "", f.r ?? ""].join(" "))),
    len: (f.w + (f.s ?? "")).length,
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
