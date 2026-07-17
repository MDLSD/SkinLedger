import "server-only";
import { prisma } from "@/lib/prisma";
import { FINISH_ORDER, WEAR_ORDER, type SkinFamily } from "@/lib/skin-search";

// Индекс семейств каталога кэшируется в памяти процесса: справочник
// меняется только при импорте, а не в рантайме.
let cache: { at: number; data: SkinFamily[] } | null = null;
const TTL_MS = 60 * 60_000;

const wearRank = new Map<string, number>(WEAR_ORDER.map((w, i) => [w, i]));
const finishRank = new Map<string, number>(FINISH_ORDER.map((f, i) => [f, i]));
const sortBy = (rank: Map<string, number>) => (s: Set<string>) =>
  [...s].sort((a, b) => (rank.get(a) ?? 99) - (rank.get(b) ?? 99));
const sortWears = sortBy(wearRank);
const sortFinishes = sortBy(finishRank);

type Acc = SkinFamily & {
  _wears: Set<string>;
  _st: Set<string>;
  _sv: Set<string>;
  _finishes: Set<string>;
};

export async function getSkinFamilies(): Promise<SkinFamily[]> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.data;

  const rows = await prisma.marketItem.findMany({
    select: {
      kind: true,
      familyId: true,
      weapon: true,
      skinName: true,
      ruSkinName: true,
      wear: true,
      stattrak: true,
      souvenir: true,
      star: true,
      stickerName: true,
      finish: true,
      stickerType: true,
      image: true,
    },
  });

  const byFamily = new Map<string, Acc>();
  for (const r of rows) {
    let f = byFamily.get(r.familyId);
    if (!f) {
      const isSkin = r.kind === "skin";
      f = {
        kind: isSkin ? "skin" : "sticker",
        f: r.familyId,
        label: isSkin
          ? r.weapon + (r.skinName ? ` | ${r.skinName}` : "")
          : (r.stickerName ?? ""),
        r: r.ruSkinName,
        img: r.image,
        w: r.weapon,
        s: r.skinName,
        star: r.star,
        wears: [],
        stWears: [],
        svWears: [],
        st: false,
        sv: false,
        finishes: [],
        stickerType: r.stickerType,
        _wears: new Set(),
        _st: new Set(),
        _sv: new Set(),
        _finishes: new Set(),
      };
      byFamily.set(r.familyId, f);
    }

    if (r.kind === "sticker") {
      // Картинку берём с базового (Paper) варианта.
      if (r.finish === "Paper" && r.image) f.img = r.image;
      if (r.finish) f._finishes.add(r.finish);
      continue;
    }

    // skin: картинку — с обычного варианта (без плашки).
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
    ({ _wears, _st, _sv, _finishes, ...f }) => ({
      ...f,
      wears: sortWears(_wears),
      stWears: sortWears(_st),
      svWears: sortWears(_sv),
      finishes: sortFinishes(_finishes),
    }),
  );

  cache = { at: Date.now(), data };
  return data;
}
