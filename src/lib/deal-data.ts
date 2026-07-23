// Сборка данных сделки для записи в БД из провалидированного ввода.
// Выделено из server-action модуля, т.к. "use server" разрешает
// экспортировать только async-функции.
import type { DealInput } from "@/lib/validation";

export function dealData(userId: string, d: DealInput) {
  const isHolding = d.status === "holding";

  return {
    userId,
    itemName: d.itemName,
    itemQuality: d.itemQuality ?? null,
    itemId: null as string | null,
    quantity: d.quantity,
    buyPlatformId: d.buyPlatformId,
    buyPrice: d.buyPrice,
    buyCurrency: d.buyCurrency,
    buyFxRate: d.buyFxRate ?? 1,
    buyFeePct: d.buyFeePct,
    buyDate: d.buyDate,
    status: d.status,
    sellPlatformId: isHolding ? null : (d.sellPlatformId ?? null),
    sellPrice: isHolding ? null : (d.sellPrice ?? null),
    sellCurrency: isHolding ? null : (d.sellCurrency ?? d.buyCurrency),
    // Курс нормализован вызывающим кодом относительно базовой валюты.
    // Фолбэк на 1 — страховка.
    sellFxRate: isHolding ? null : (d.sellFxRate ?? 1),
    sellFeePct: isHolding ? null : (d.sellFeePct ?? 0),
    sellDate: isHolding ? null : (d.sellDate ?? null),
    note: d.note ?? null,
  };
}
