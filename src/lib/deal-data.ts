// Сборка данных сделки для записи в БД из провалидированного ввода.
// Выделено из server-action модуля, т.к. "use server" разрешает
// экспортировать только async-функции.
import { buyCostBase, sellRevenueBase } from "@/lib/deal-math";
import type { DealInput } from "@/lib/validation";

export function dealData(userId: string, d: DealInput) {
  const isHolding = d.status === "holding";
  // Для выводных скинов фиксируем фактическую потерю на выводе в %.
  let withdrawalDiscountPct: number | null = null;
  if (d.status === "withdrawn_via_skin" && d.sellPrice != null) {
    const cost = buyCostBase({
      quantity: d.quantity,
      buyPrice: d.buyPrice,
      buyFeePct: d.buyFeePct,
      buyFxRate: d.buyFxRate ?? 1,
    });
    const revenue = sellRevenueBase({
      quantity: d.quantity,
      buyPrice: d.buyPrice,
      buyFeePct: d.buyFeePct,
      buyFxRate: d.buyFxRate ?? 1,
      sellPrice: d.sellPrice,
      sellFeePct: d.sellFeePct,
      sellFxRate: d.sellFxRate,
    });
    if (revenue != null && cost > 0) {
      withdrawalDiscountPct = ((cost - revenue) / cost) * 100;
    }
  }

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
    withdrawalDiscountPct,
    note: d.note ?? null,
  };
}
