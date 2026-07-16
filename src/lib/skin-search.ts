// Общая логика поиска и сборки market_hash_name.
// Используется и на клиенте (автокомплит, live-превью), и на сервере.

export type SkinFamily = {
  f: string; // skinFamilyId
  w: string; // weapon
  s: string | null; // skinName (pattern)
  r: string | null; // ruSkinName
  star: boolean; // ★ (ножи/перчатки)
  st: boolean; // есть StatTrak-вариант
  sv: boolean; // есть Souvenir-вариант
  wears: string[]; // доступные износы (в порядке FN…BS)
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

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[★™|()\-–—.,/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

type Indexed = SkinFamily & { _hay: string; _len: number };

/** Предподготовка семейств для быстрого повторного поиска. */
export function indexFamilies(families: SkinFamily[]): Indexed[] {
  return families.map((f) => ({
    ...f,
    _hay: normalize([f.w, f.s ?? "", f.r ?? ""].join(" ")),
    _len: (f.w + (f.s ?? "")).length,
  }));
}

/**
 * Поиск по подстрокам: все токены запроса должны найтись в haystack
 * (англ. оружие + англ. скин + рус. скин). Ранжирование: раньше позиция и
 * совпадение с началом слова — выше; при равенстве — короче название.
 */
export function searchFamilies(
  indexed: Indexed[],
  query: string,
  limit = 30,
): SkinFamily[] {
  const tokens = normalize(query).split(" ").filter(Boolean);
  if (tokens.length === 0) return [];

  const scored: { f: Indexed; score: number }[] = [];
  for (const f of indexed) {
    let ok = true;
    let score = 0;
    for (const t of tokens) {
      const pos = f._hay.indexOf(t);
      if (pos === -1) {
        ok = false;
        break;
      }
      const atWordStart = pos === 0 || f._hay[pos - 1] === " ";
      score += pos + (atWordStart ? 0 : 40);
    }
    if (ok) scored.push({ f, score });
  }

  scored.sort((a, b) => a.score - b.score || a.f._len - b.f._len);
  return scored.slice(0, limit).map(({ f }) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { _hay, _len, ...family } = f;
    return family;
  });
}
