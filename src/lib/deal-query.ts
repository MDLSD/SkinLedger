// Единая серверная выборка сделок для списка и экспорта: одинаковые фильтры,
// маппинг в DTO и сортировка — чтобы CSV-экспорт совпадал со списком.
import "server-only";
import { prisma } from "@/lib/prisma";
import { holdingDays, marginPct, profit } from "@/lib/deal-math";
import { fxFactor, type Rates } from "@/lib/currency";
import { getRates, type RatesSource } from "@/lib/rates";
import { periodRange, type DealFilters, type SortKey } from "@/lib/deal-list";
import type { DealDTO } from "@/lib/types";

// Верхняя граница выборки в память (NFR: < 1 с при 5000 сделок).
const MAX_ROWS = 5000;

function toDateStr(d: Date | null): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

export type LoadedDeals = {
  // Отфильтрованы и отсортированы, БЕЗ пагинации.
  deals: DealDTO[];
  base: string;
  rates: Rates;
  ratesSource: RatesSource;
  // Сколько сделок выпало из выборки из-за отсутствующего курса валюты.
  unresolvedFx: number;
};

export async function loadUserDeals(
  userId: string,
  filters: DealFilters,
): Promise<LoadedDeals> {
  // Фильтры, сводимые к SQL: статус, площадка, период.
  // Период — по дате ЗАКРЫТИЯ, как на дашборде: раньше список брал buyDate,
  // и одна и та же сделка попадала в разные множества на двух страницах.
  // Холд под период не подпадает вообще — у него нет даты закрытия, и
  // «заморожено в холде» на дашборде тоже считается по всем открытым.
  // Оба условия — через AND, потому что OR здесь уже занят площадкой.
  const where: Record<string, unknown> = { userId };
  const and: Record<string, unknown>[] = [];
  if (filters.status !== "all") where.status = filters.status;
  if (filters.platform !== "all") {
    and.push({
      OR: [
        { buyPlatformId: filters.platform },
        { sellPlatformId: filters.platform },
      ],
    });
  }
  const range = periodRange(filters);
  if (range) and.push({ OR: [{ status: "holding" }, { sellDate: range }] });
  if (and.length) where.AND = and;

  const [user, dealRows, { rates, source: ratesSource }] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { baseCurrency: true },
    }),
    prisma.deal.findMany({
      where,
      include: { buyPlatform: true, sellPlatform: true, item: true },
      take: MAX_ROWS,
    }),
    getRates(),
  ]);
  const base = user.baseCurrency;

  let unresolvedFx = 0;
  let all: DealDTO[] = dealRows.flatMap((d) => {
    // Курс к базовой валюте — из текущих курсов парсера (авто-конвертация).
    const buyFxRate = fxFactor(d.buyCurrency, base, rates);
    const sellFxRate = d.sellCurrency ? fxFactor(d.sellCurrency, base, rates) : null;
    // Курса нет — считать по 1:1 нельзя (расхождение в разы), поэтому сделку
    // исключаем из выборки и сообщаем о ней отдельно, а не показываем число.
    if (buyFxRate == null || (d.sellCurrency != null && sellFxRate == null)) {
      unresolvedFx++;
      return [];
    }
    return [
      {
        id: d.id,
        itemName: d.itemName,
        itemQuality: d.itemQuality,
        quantity: d.quantity,
        buyPlatformId: d.buyPlatformId,
        buyPlatformName: d.buyPlatform.name,
        buyPrice: Number(d.buyPrice),
        buyCurrency: d.buyCurrency,
        buyFxRate,
        buyFeePct: Number(d.buyFeePct),
        buyDate: toDateStr(d.buyDate)!,
        status: d.status,
        sellPlatformId: d.sellPlatformId,
        sellPlatformName: d.sellPlatform?.name ?? null,
        sellPrice: d.sellPrice != null ? Number(d.sellPrice) : null,
        sellCurrency: d.sellCurrency,
        sellFxRate,
        sellFeePct: d.sellFeePct != null ? Number(d.sellFeePct) : null,
        sellDate: toDateStr(d.sellDate),
        note: d.note,
        itemId: d.itemId,
        itemFamilyId: d.item?.familyId ?? null,
        itemKind: d.item?.kind ?? null,
        itemStattrak: d.item?.stattrak ?? false,
        itemSouvenir: d.item?.souvenir ?? false,
      },
    ];
  });

  // Поиск по названию (регистронезависимо; SQLite LIKE не покрывает кириллицу).
  if (filters.q.trim()) {
    const q = filters.q.trim().toLowerCase();
    all = all.filter((d) => d.itemName.toLowerCase().includes(q));
  }

  // Сортировка — в т.ч. по вычисляемым полям (прибыль/маржа/дни).
  const num = (v: number | null, dir: number) =>
    v == null ? dir * -Infinity : v; // null всегда в конец
  const sortDir = filters.dir === "asc" ? 1 : -1;
  const comparators: Record<SortKey, (a: DealDTO, b: DealDTO) => number> = {
    item: (a, b) => a.itemName.localeCompare(b.itemName, "ru"),
    // Цены сравниваем в базовой валюте (цена × курс к базовой).
    buyPrice: (a, b) => a.buyPrice * a.buyFxRate - b.buyPrice * b.buyFxRate,
    sellPrice: (a, b) =>
      num(a.sellPrice == null ? null : a.sellPrice * (a.sellFxRate ?? 1), -sortDir) -
      num(b.sellPrice == null ? null : b.sellPrice * (b.sellFxRate ?? 1), -sortDir),
    profit: (a, b) => num(profit(a), -sortDir) - num(profit(b), -sortDir),
    margin: (a, b) => num(marginPct(a), -sortDir) - num(marginPct(b), -sortDir),
    days: (a, b) =>
      holdingDays(a.buyDate, a.sellDate) - holdingDays(b.buyDate, b.sellDate),
    status: (a, b) => a.status.localeCompare(b.status),
    buyDate: (a, b) => a.buyDate.localeCompare(b.buyDate),
  };
  all.sort((a, b) => sortDir * comparators[filters.sort](a, b));

  return { deals: all, base, rates, ratesSource, unresolvedFx };
}
