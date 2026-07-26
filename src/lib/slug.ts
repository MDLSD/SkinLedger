// ЧПУ для публичных страниц предметов (ТЗ 7.2): латиница, нижний регистр,
// разделитель — дефис. Slug генерируется один раз при создании MarketItem и
// дальше не меняется: смена ломает проиндексированные ссылки.

// Транслитерация кириллицы. Названия в market_hash_name латинские, но в базу
// может попасть предмет с русским именем — на этот случай.
const TRANSLIT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z",
  и: "i", й: "i", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
  с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "c", ч: "ch", ш: "sh", щ: "sch",
  ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

/**
 * "AK-47 | Redline (Field-Tested)"      → "ak-47-redline-field-tested"
 * "★ Karambit | Doppler (Factory New)"  → "karambit-doppler-factory-new"
 * "StatTrak™ AWP | Азимов"              → "stattrak-awp-azimov"
 *
 * Пустая строка на выходе означает, что в имени не было ни букв, ни цифр —
 * вызывающий код должен подставить запасной ключ (см. slugFor).
 */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    // Диакритика: "Ünité" → "unite".
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[а-яё]/g, (c) => TRANSLIT[c] ?? "")
    // Всё, что не латиница и не цифра, становится разделителем: символы ™ ★ |
    // ( ) пробелы, знаки препинания.
    .replace(/[^a-z0-9]+/g, "-")
    // Схлопывание повторов и обрезка по краям.
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Slug предмета: обычный slugify с запасным вариантом, если имя состоит из
 * одних символов (иероглифы, эмодзи) — тогда берём стабильный хеш имени.
 */
export function slugFor(marketHashName: string): string {
  const s = slugify(marketHashName);
  return s || `item-${fnv1a(marketHashName)}`;
}

/**
 * Уникальный slug: при коллизии добавляется числовой суффикс (`-2`, `-3`, …).
 * `taken` — множество уже занятых slug; функция сама добавляет в него выданный.
 */
export function uniqueSlug(base: string, taken: Set<string>): string {
  if (!taken.has(base)) {
    taken.add(base);
    return base;
  }
  for (let n = 2; ; n++) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) {
      taken.add(candidate);
      return candidate;
    }
  }
}

function fnv1a(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}
