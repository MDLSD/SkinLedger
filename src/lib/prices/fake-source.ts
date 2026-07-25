// Фейковый источник цен для разработки без платной подписки Pricempire.
// Генерирует правдоподобные цены по нашему каталогу: детерминированная базовая
// цена на предмет + множитель площадки (создаёт спреды/арбитраж) + джиттер на
// каждый тик (двигает историю). Реальный Pricempire подключается заменой этого
// файла на адаптер с тем же интерфейсом PriceSource.
import { prisma } from "@/lib/prisma";
import type { PriceSource, SourceItemPrices, SourcePrice } from "./source";

// Сколько предметов каталога озвучивать ценами (для демо; настраивается).
const SAMPLE = Number(process.env.PRICES_SAMPLE ?? 2500);
const MIN_USD = 0.5;

// Множители площадок: buff дешевле, steam дороже → появляются связки.
const MULT: Record<string, number> = {
  steam: 1.13,
  buff163: 0.92,
  market_csgo: 1.0,
  cs_money: 1.05,
  skinport: 1.08,
  dmarket: 1.03,
  lis_skins: 0.97,
  bitskins: 1.01,
};

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Базовая цена $0.5…~$2500 с экспоненциальным разбросом (большинство дешёвые).
function basePrice(mhn: string): number {
  const r = (hashStr(mhn) % 100000) / 100000; // 0..1
  return Math.round(0.5 * Math.pow(5000, r) * 100) / 100;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export function fakeSource(): PriceSource {
  return {
    async fetchPrices(slugs: string[]): Promise<SourceItemPrices[]> {
      const items = await prisma.marketItem.findMany({
        select: { marketHashName: true },
        orderBy: { id: "asc" },
        take: SAMPLE,
      });

      const out: SourceItemPrices[] = [];
      for (const it of items) {
        const base = basePrice(it.marketHashName);
        if (base < MIN_USD) continue;
        // Ликвидность падает с ценой: дешёвые торгуются активнее.
        const liq = Math.max(1, Math.round(400 / Math.sqrt(base)));

        const prices: SourcePrice[] = slugs.map((slug) => {
          const mult = MULT[slug] ?? 1;
          const jit = 1 + (Math.random() - 0.5) * 0.04; // ±2% на тик
          const min = r2(base * mult * jit);
          return {
            sourceSlug: slug,
            priceMin: min,
            priceOrder: r2(min * 0.9),
            priceAvg30: r2(base * mult),
            priceMedian30: r2(base * mult * 0.99),
            offersCount: Math.round(liq * (0.5 + Math.random())),
            sales30d: Math.round(liq * (0.3 + Math.random() * 0.7)),
          };
        });
        out.push({ marketHashName: it.marketHashName, prices });
      }
      return out;
    },
  };
}
