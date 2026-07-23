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
  steamcommunitymarket: "Steam Market",
  steamcommunity: "Steam Market",
  "стим": "Steam Market",
  "стиммаркет": "Steam Market",
  // Market.CSGO (TM)
  marketcsgo: "Market.CSGO (TM)",
  marketcsgotm: "Market.CSGO (TM)",
  tmmarket: "Market.CSGO (TM)",
  tm: "Market.CSGO (TM)",
  "тм": "Market.CSGO (TM)",
  "маркетcsgo": "Market.CSGO (TM)",
  "маркеттм": "Market.CSGO (TM)",
  "маркет": "Market.CSGO (TM)",
  // CS.Money
  csmoney: "CS.Money",
  "ксмани": "CS.Money",
  "ксмоней": "CS.Money",
  // Buff163
  buff163: "Buff163",
  buff: "Buff163",
  "бафф": "Buff163",
  "баф": "Buff163",
  "бафф163": "Buff163",
  // Skinport
  skinport: "Skinport",
  "скинпорт": "Skinport",
  // DMarket
  dmarket: "DMarket",
  "дмаркет": "DMarket",
  // Lis-Skins
  lisskins: "Lis-Skins",
  lis: "Lis-Skins",
  "лисскинс": "Lis-Skins",
  "лискинс": "Lis-Skins",
  "лис": "Lis-Skins",
  // BitSkins
  bitskins: "BitSkins",
  "битскинс": "BitSkins",
};

/** Каноничное имя площадки по синониму, либо null если не распознано. */
export function canonicalPlatform(raw: string): string | null {
  return CANONICAL[normalizePlatform(raw)] ?? null;
}
