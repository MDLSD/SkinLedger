// Расчёт прибыли по связке «купить на A → продать на B». Формула из ТЗ,
// та же логика, что в сделках (deal-math), но комиссии берём из площадок-
// источников: покупка облагается buyFee площадки A, продажа — sellFee + выводом
// (withdrawFee) площадки B.

export type SourceFees = {
  buyFeePct: number;
  sellFeePct: number;
  withdrawFeePct: number;
};

export type ProfitResult = {
  netBuy: number; // во что реально обходится покупка на A
  netSell: number; // сколько реально получим на руки, продав на B
  profit: number; // netSell − netBuy
  profitPct: number; // profit / netBuy × 100
};

/** Чистая покупка на площадке A: цена + комиссия покупки. */
export function netBuyCost(buyPrice: number, feesA: SourceFees): number {
  return buyPrice * (1 + feesA.buyFeePct / 100);
}

/** Чистая выручка на площадке B: цена − комиссия продажи − комиссия вывода. */
export function netSellRevenue(sellPrice: number, feesB: SourceFees): number {
  return sellPrice * (1 - feesB.sellFeePct / 100) * (1 - feesB.withdrawFeePct / 100);
}

/** Прибыль связки: купить на A по buyPrice, продать на B по sellPrice. */
export function computeProfit(
  buyPrice: number,
  sellPrice: number,
  feesA: SourceFees,
  feesB: SourceFees,
): ProfitResult {
  const netBuy = netBuyCost(buyPrice, feesA);
  const netSell = netSellRevenue(sellPrice, feesB);
  const profit = netSell - netBuy;
  return {
    netBuy,
    netSell,
    profit,
    profitPct: netBuy > 0 ? (profit / netBuy) * 100 : 0,
  };
}
