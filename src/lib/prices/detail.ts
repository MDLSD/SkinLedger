// Типы и параметры панели предмета (график + стакан), которая раскрывается под
// строкой таблицы по клику на цену. Чистый модуль: используется и клиентом
// (компонент строки), и сервером (роут /api/prices/history).

export const PERIODS = [
  { value: "1w", label: "1w", days: 7 },
  { value: "1m", label: "1m", days: 30 },
  { value: "3m", label: "3m", days: 90 },
  { value: "6m", label: "6m", days: 180 },
  { value: "all", label: "All", days: null },
] as const;

export type Period = (typeof PERIODS)[number]["value"];

export const isPeriod = (v: string): v is Period =>
  PERIODS.some((p) => p.value === v);

export const periodDays = (p: Period): number | null =>
  PERIODS.find((x) => x.value === p)?.days ?? null;

/** Точка истории цены: время (мс) и цена в USD. */
export type HistoryPoint = { t: number; p: number };

/** Уровень стакана: цена и количество (количество бывает неизвестно). */
export type BookLevel = { price: number; count: number | null };

export type SourceDetail = {
  sourceSlug: string;
  points: HistoryPoint[];
  min: number | null;
  max: number | null;
  avg: number | null;
  /** Лучший запрос на продажу — минимальный листинг. */
  sell: BookLevel | null;
  /** Лучший запрос на покупку — цена ордера (авто-бай). */
  buy: BookLevel | null;
};

export type ItemDetail = {
  item: string;
  period: Period;
  sources: SourceDetail[];
};
