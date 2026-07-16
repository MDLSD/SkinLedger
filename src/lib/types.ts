export type PlatformDTO = {
  id: string;
  name: string;
  defaultBuyFeePct: number;
  defaultSellFeePct: number;
  isCustom: boolean;
};

export type DealDTO = {
  id: string;
  itemName: string;
  itemQuality: string | null;
  quantity: number;
  buyPlatformId: string;
  buyPlatformName: string;
  buyPrice: number;
  buyCurrency: string;
  buyFxRate: number;
  buyFeePct: number;
  buyDate: string; // yyyy-MM-dd
  status: string;
  sellPlatformId: string | null;
  sellPlatformName: string | null;
  sellPrice: number | null;
  sellCurrency: string | null;
  sellFxRate: number | null;
  sellFeePct: number | null;
  sellDate: string | null; // yyyy-MM-dd
  note: string | null;
};
