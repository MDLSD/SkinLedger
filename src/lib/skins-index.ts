import "server-only";
import { prisma } from "@/lib/prisma";
import { WEAR_ORDER, type SkinFamily } from "@/lib/skin-search";

// Индекс семейств скинов кэшируется в памяти процесса: справочник
// меняется только при импорте, а не в рантайме.
let cache: { at: number; data: SkinFamily[] } | null = null;
const TTL_MS = 60 * 60_000;

const wearRank = new Map<string, number>(WEAR_ORDER.map((w, i) => [w, i]));
const sortWears = (ws: Set<string>) =>
  [...ws].sort((a, b) => (wearRank.get(a) ?? 99) - (wearRank.get(b) ?? 99));

type Acc = SkinFamily & {
  _wears: Set<string>;
  _st: Set<string>;
  _sv: Set<string>;
};

export async function getSkinFamilies(): Promise<SkinFamily[]> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.data;

  const rows = await prisma.skin.findMany({
    select: {
      skinFamilyId: true,
      weapon: true,
      skinName: true,
      ruSkinName: true,
      wear: true,
      stattrak: true,
      souvenir: true,
      star: true,
      image: true,
    },
  });

  const byFamily = new Map<string, Acc>();
  for (const r of rows) {
    let f = byFamily.get(r.skinFamilyId);
    if (!f) {
      f = {
        f: r.skinFamilyId,
        w: r.weapon,
        s: r.skinName,
        r: r.ruSkinName,
        star: r.star,
        img: r.image,
        wears: [],
        stWears: [],
        svWears: [],
        st: false,
        sv: false,
        _wears: new Set(),
        _st: new Set(),
        _sv: new Set(),
      };
      byFamily.set(r.skinFamilyId, f);
    }
    // Картинку берём с обычного варианта (без StatTrak/Souvenir-плашки).
    if (!r.stattrak && !r.souvenir && r.image) f.img = r.image;

    if (r.souvenir) {
      f.sv = true;
      if (r.wear) f._sv.add(r.wear);
    } else if (r.stattrak) {
      f.st = true;
      if (r.wear) f._st.add(r.wear);
    } else if (r.wear) {
      f._wears.add(r.wear);
    }
  }

  const data: SkinFamily[] = [...byFamily.values()].map(
    ({ _wears, _st, _sv, ...f }) => ({
      ...f,
      wears: sortWears(_wears),
      stWears: sortWears(_st),
      svWears: sortWears(_sv),
    }),
  );

  cache = { at: Date.now(), data };
  return data;
}
