// Фейковый источник цен для разработки без платной подписки Pricempire.
// Генерирует правдоподобные цены по нашему каталогу: детерминированная базовая
// цена на предмет + множитель площадки (создаёт спреды/арбитраж) + джиттер на
// каждый тик (двигает историю). Реальный Pricempire подключается заменой этого
// файла на адаптер с тем же интерфейсом PriceSource.
import { prisma } from "@/lib/prisma";
import type {
  PriceSource,
  SourceItemHistory,
  SourceItemPrices,
  SourcePrice,
} from "./source";

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

// Детерминированный ГПСЧ: одна и та же пара (предмет, площадка) всегда даёт
// одну и ту же кривую — повторный бэкфилл не меняет уже показанную историю.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Сетка времени для истории: чем дальше в прошлое, тем реже точки — иначе на
 * полгода по 2500 предметов и 8 площадок получаются миллионы строк без пользы
 * для глаза. Последние 30 дней — по точке в день, дальше — по точке в неделю.
 */
export function historyGrid(days: number, now = new Date()): Date[] {
  // Точки ставим на начало суток: сегодняшний день пишет крон, бэкфилл — только
  // прошлое, поэтому граница — вчера.
  const midnight = new Date(now);
  midnight.setHours(0, 0, 0, 0);
  const out: Date[] = [];
  for (let d = days; d >= 1; d--) {
    if (d > 30 && d % 7 !== 0) continue;
    out.push(new Date(midnight.getTime() - d * 86400_000));
  }
  return out;
}

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

    // Историю рисуем обратным случайным блужданием от текущей цены: последняя
    // точка стыкуется с тем, что сейчас в котировках, дальше в прошлое цена
    // расходится. Волатильность и дрейф зависят от предмета — кривые разные.
    async fetchHistory(
      marketHashNames: string[],
      slugs: string[],
      days: number,
    ): Promise<SourceItemHistory[]> {
      const grid = historyGrid(days);
      const out: SourceItemHistory[] = [];

      for (const mhn of marketHashNames) {
        const base = basePrice(mhn);
        if (base < MIN_USD) continue;

        for (const slug of slugs) {
          const rnd = mulberry32(hashStr(`${mhn}|${slug}|history`));
          const vol = 0.01 + rnd() * 0.04; // 1–5% шага
          const drift = (rnd() - 0.5) * 0.004; // лёгкий тренд в обе стороны
          let price = base * (MULT[slug] ?? 1);

          const points = new Array(grid.length);
          for (let i = grid.length - 1; i >= 0; i--) {
            points[i] = { ts: grid[i], price: r2(price) };
            // Шаг назад: снимаем дрейф и добавляем шум.
            const shock = (rnd() - 0.5) * 2 * vol;
            price = Math.max(MIN_USD, price / (1 + drift + shock));
          }
          out.push({ marketHashName: mhn, sourceSlug: slug, points });
        }
      }
      return out;
    },
  };
}
