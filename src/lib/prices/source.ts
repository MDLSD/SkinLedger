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

/** Точка исторической кривой цены (USD). */
export type SourceHistoryPoint = { ts: Date; price: number };

export type SourceItemHistory = {
  marketHashName: string;
  sourceSlug: string;
  points: SourceHistoryPoint[]; // от старых к новым
};

export interface PriceSource {
  /** Вернуть цены по всем предметам для указанных площадок (в USD). */
  fetchPrices(sourceSlugs: string[]): Promise<SourceItemPrices[]>;

  /**
   * История цен за `days` дней назад — чтобы график был сразу, а не копился
   * тиками крона. Метод необязательный: источник может истории не отдавать
   * (тогда бэкфилл просто нечем наполнить). Разрешение точек выбирает сам
   * источник; предметы передаются пачками, чтобы не держать всё в памяти.
   */
  fetchHistory?(
    marketHashNames: string[],
    sourceSlugs: string[],
    days: number,
  ): Promise<SourceItemHistory[]>;
}
