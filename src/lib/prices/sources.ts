// Площадки-источники цен по умолчанию + наши комиссии (агрегатор их не отдаёт).
// slug — ключ провайдера у Pricempire (при подключении реального адаптера сюда
// же ложатся его provider_key). Комиссии — ориентировочные, редактируются.

export type SourceSeed = {
  slug: string;
  title: string;
  currency: string;
  buyFeePct: number;
  sellFeePct: number;
  withdrawFeePct: number;
};

export const DEFAULT_SOURCES: SourceSeed[] = [
  { slug: "steam", title: "Steam Market", currency: "USD", buyFeePct: 0, sellFeePct: 13, withdrawFeePct: 0 },
  { slug: "buff163", title: "Buff163", currency: "CNY", buyFeePct: 0, sellFeePct: 2.5, withdrawFeePct: 5 },
  { slug: "market_csgo", title: "Market.CSGO", currency: "USD", buyFeePct: 0, sellFeePct: 5, withdrawFeePct: 3 },
  { slug: "cs_money", title: "CS.Money", currency: "USD", buyFeePct: 0, sellFeePct: 7, withdrawFeePct: 0 },
  { slug: "skinport", title: "Skinport", currency: "EUR", buyFeePct: 0, sellFeePct: 12, withdrawFeePct: 0 },
  { slug: "dmarket", title: "DMarket", currency: "USD", buyFeePct: 0, sellFeePct: 7, withdrawFeePct: 4 },
  { slug: "lis_skins", title: "Lis-Skins", currency: "USD", buyFeePct: 0, sellFeePct: 5, withdrawFeePct: 0 },
  { slug: "bitskins", title: "BitSkins", currency: "USD", buyFeePct: 0, sellFeePct: 5, withdrawFeePct: 0 },
];
