import "server-only";
import { prisma } from "@/lib/prisma";
import { WEAR_ORDER, type SkinFamily } from "@/lib/skin-search";

// Индекс семейств скинов кэшируется в памяти процесса: справочник
// меняется только при импорте, а не в рантайме.
let cache: { at: number; data: SkinFamily[] } | null = null;
const TTL_MS = 60 * 60_000;

const wearRank = new Map<string, number>(WEAR_ORDER.map((w, i) => [w, i]));

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
    },
  });

  const byFamily = new Map<string, SkinFamily & { _wears: Set<string> }>();
  for (const r of rows) {
    let f = byFamily.get(r.skinFamilyId);
    if (!f) {
      f = {
        f: r.skinFamilyId,
        w: r.weapon,
        s: r.skinName,
        r: r.ruSkinName,
        star: r.star,
        st: false,
        sv: false,
        wears: [],
        _wears: new Set(),
      };
      byFamily.set(r.skinFamilyId, f);
    }
    if (r.stattrak) f.st = true;
    if (r.souvenir) f.sv = true;
    if (r.wear) f._wears.add(r.wear);
  }

  const data: SkinFamily[] = [...byFamily.values()].map(({ _wears, ...f }) => ({
    ...f,
    wears: [..._wears].sort(
      (a, b) => (wearRank.get(a) ?? 99) - (wearRank.get(b) ?? 99),
    ),
  }));

  cache = { at: Date.now(), data };
  return data;
}
