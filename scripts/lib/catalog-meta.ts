/**
 * weapon / collection / rarity по market_hash_name из каталожного датасета
 * ByMykel/CSGO-API (ТЗ 2.2: поля для страниц-хабов и хлебных крошек).
 *
 * Где что лежит в датасете:
 *  - weapon и rarity — прямо в записи предмета (у всех видов есть `rarity`);
 *  - collection — в `collections[]`, но у скинов только в СГРУППИРОВАННОМ
 *    en/skins.json (по семейству skin_id), а не в skins_not_grouped.json.
 *
 * Предмета в датасете нет → в карте его нет → поля остаются null. Это не ошибка:
 * каталог обгоняет датасет на свежих предметах.
 */

export type ItemMeta = {
  weapon: string | null;
  collection: string | null;
  rarity: string | null;
};

type Named = { name?: string | null } | null | undefined;
type Collections = { name?: string | null }[] | null | undefined;

/** Запись любого вида предмета: берём только то, что нужно для меты. */
export type MetaSource = {
  market_hash_name?: string | null;
  name?: string | null;
  weapon?: Named;
  rarity?: Named;
  collections?: Collections;
};

/** Скин из skins_not_grouped.json: семейство хранит коллекцию. */
export type MetaSkin = MetaSource & { skin_id?: string | null };

/** Семейство скинов из сгруппированного skins.json. */
export type MetaSkinFamily = { id?: string | null; collections?: Collections };

const first = (c: Collections): string | null => c?.[0]?.name ?? null;
const nameOf = (n: Named): string | null => n?.name ?? null;

/**
 * Собрать карту market_hash_name → мета.
 * `skins` — skins_not_grouped.json, `families` — сгруппированный skins.json,
 * `others` — стикеры, агенты, кейсы, брелки, патчи, граффити, музкиты и т.д.
 */
export function buildMetaMap(
  skins: MetaSkin[],
  families: MetaSkinFamily[],
  others: MetaSource[][],
): Map<string, ItemMeta> {
  const collectionByFamily = new Map<string, string>();
  for (const f of families) {
    const c = first(f.collections);
    if (f.id && c) collectionByFamily.set(f.id, c);
  }

  const map = new Map<string, ItemMeta>();
  for (const s of skins) {
    const mhn = s.market_hash_name;
    if (!mhn) continue;
    map.set(mhn, {
      weapon: nameOf(s.weapon),
      collection: (s.skin_id && collectionByFamily.get(s.skin_id)) || null,
      rarity: nameOf(s.rarity),
    });
  }
  for (const list of others) {
    for (const it of list) {
      // Агенты в каталоге ключуются так же: market_hash_name, иначе name.
      const mhn = it.market_hash_name ?? it.name;
      if (!mhn || map.has(mhn)) continue;
      map.set(mhn, {
        weapon: nameOf(it.weapon),
        collection: first(it.collections),
        rarity: nameOf(it.rarity),
      });
    }
  }
  return map;
}
