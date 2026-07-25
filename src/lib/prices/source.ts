// Контракт источника цен. Любой источник (фейковый сейчас, Pricempire позже)
// приводит ответ к этим нормализованным типам. Цены — в USD.
// Подключение реального Pricempire = один новый файл с этим интерфейсом.

export type SourcePrice = {
  sourceSlug: string;
  priceMin: number | null; // минимальный листинг
  priceOrder: number | null; // ордер покупки (авто-бай)
  priceAvg30: number | null;
  priceMedian30: number | null;
  offersCount: number | null;
  sales30d: number | null; // ликвидность
};

export type SourceItemPrices = {
  marketHashName: string;
  prices: SourcePrice[];
};

export interface PriceSource {
  /** Вернуть цены по всем предметам для указанных площадок (в USD). */
  fetchPrices(sourceSlugs: string[]): Promise<SourceItemPrices[]>;
}
