// Синонимы площадок для импорта: пользовательские написания («market csgo»,
// «steam», «cs money») сводим к каноничным именам из сида, чтобы не плодить
// дубликаты и подтягивать комиссию площадки.

/** Нормализация имени: только буквы/цифры в нижнем регистре (RU+EN). */
export function normalizePlatform(s: string): string {
  return s.toLowerCase().replace(/[^0-9a-zа-яё]/gi, "");
}

// Ключ — нормализованное написание, значение — каноничное имя (как в seed.ts).
const CANONICAL: Record<string, string> = {
  // Steam Market
  steam: "Steam Market",
  steammarket: "Steam Market",
  steammarketplace: "Steam Market",
  steamcommunity: "Steam Market",
  steamcommunitymarket: "Steam Market",
  steamcommunitymarketplace: "Steam Market",
  steamcm: "Steam Market",
  scm: "Steam Market",
  steammarketru: "Steam Market",
  valvemarket: "Steam Market",
  "стим": "Steam Market",
  "стиммаркет": "Steam Market",
  "стиммаркетплейс": "Steam Market",
  "стимрынок": "Steam Market",
  "стимкоммьюнити": "Steam Market",
  "стимка": "Steam Market",
  "стима": "Steam Market",
  // Market.CSGO (TM)
  market: "Market.CSGO (TM)",
  marketcsgo: "Market.CSGO (TM)",
  marketcsgotm: "Market.CSGO (TM)",
  marketcsgocom: "Market.CSGO (TM)",
  marketcs: "Market.CSGO (TM)",
  csgomarket: "Market.CSGO (TM)",
  tmmarket: "Market.CSGO (TM)",
  tmcsgo: "Market.CSGO (TM)",
  tm: "Market.CSGO (TM)",
  "тм": "Market.CSGO (TM)",
  "тммаркет": "Market.CSGO (TM)",
  "маркет": "Market.CSGO (TM)",
  "маркетcsgo": "Market.CSGO (TM)",
  "маркетксго": "Market.CSGO (TM)",
  "маркеттм": "Market.CSGO (TM)",
  "маркетплейс": "Market.CSGO (TM)",
  // CS.Money
  csmoney: "CS.Money",
  csmoneycom: "CS.Money",
  csgomoney: "CS.Money",
  csm: "CS.Money",
  "ксмани": "CS.Money",
  "ксмоней": "CS.Money",
  "ксмони": "CS.Money",
  "ксм": "CS.Money",
  "ксгомани": "CS.Money",
  // Buff163
  buff163: "Buff163",
  buff: "Buff163",
  buff163com: "Buff163",
  buffmarket: "Buff163",
  buff163market: "Buff163",
  buffcsgo: "Buff163",
  "бафф": "Buff163",
  "баф": "Buff163",
  "буфф": "Buff163",
  "буф": "Buff163",
  "бафф163": "Buff163",
  "буфф163": "Buff163",
  "баф163": "Buff163",
  "баффмаркет": "Buff163",
  // Skinport
  skinport: "Skinport",
  skinportcom: "Skinport",
  skinportmarket: "Skinport",
  skinports: "Skinport",
  "скинпорт": "Skinport",
  "скинпортмаркет": "Skinport",
  "скинпорд": "Skinport",
  "скинпортком": "Skinport",
  // DMarket
  dmarket: "DMarket",
  dmarketcom: "DMarket",
  dmarketplace: "DMarket",
  demarket: "DMarket",
  "дмаркет": "DMarket",
  "дэмаркет": "DMarket",
  "димаркет": "DMarket",
  "дмаркетком": "DMarket",
  // Lis-Skins
  lisskins: "Lis-Skins",
  lisskin: "Lis-Skins",
  lisskinscom: "Lis-Skins",
  lis: "Lis-Skins",
  liss: "Lis-Skins",
  "лисскинс": "Lis-Skins",
  "лискинс": "Lis-Skins",
  "лисскин": "Lis-Skins",
  "лисскинском": "Lis-Skins",
  "лис": "Lis-Skins",
  "лиссскинс": "Lis-Skins",
  // BitSkins
  bitskins: "BitSkins",
  bitskin: "BitSkins",
  bitskinscom: "BitSkins",
  bits: "BitSkins",
  "битскинс": "BitSkins",
  "битскин": "BitSkins",
  "битскинском": "BitSkins",
  "битс": "BitSkins",
};

/** Каноничное имя площадки по синониму, либо null если не распознано. */
export function canonicalPlatform(raw: string): string | null {
  return CANONICAL[normalizePlatform(raw)] ?? null;
}
