/*
  MarketItem: поля для публичных SEO-страниц (ТЗ 2.2 и 7.2) — slug, collection, rarity.

  slug объявлен NOT NULL UNIQUE, а таблица не пуста, поэтому существующим строкам
  при переносе проставляется market_hash_name: значение заведомо уникально и не
  нарушает ограничений. Это ВРЕМЕННАЯ заглушка — сразу после миграции нужно
  выполнить `npm run backfill:item-slugs`, который заменит её на настоящие ЧПУ
  и заполнит weapon/collection/rarity. Новые предметы получают slug сразу при
  импорте каталога (scripts/import-catalog.ts).
*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_market_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL DEFAULT 'skin',
    "external_id" TEXT NOT NULL,
    "family_id" TEXT NOT NULL,
    "weapon" TEXT,
    "skin_name" TEXT,
    "wear" TEXT,
    "stattrak" BOOLEAN NOT NULL DEFAULT false,
    "souvenir" BOOLEAN NOT NULL DEFAULT false,
    "star" BOOLEAN NOT NULL DEFAULT false,
    "sticker_name" TEXT,
    "finish" TEXT,
    "sticker_type" TEXT,
    "tournament" TEXT,
    "market_hash_name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "collection" TEXT,
    "rarity" TEXT,
    "image" TEXT,
    "ru_weapon" TEXT,
    "ru_skin_name" TEXT
);
INSERT INTO "new_market_items" ("external_id", "family_id", "finish", "id", "image", "kind", "market_hash_name", "ru_skin_name", "ru_weapon", "skin_name", "souvenir", "star", "stattrak", "sticker_name", "sticker_type", "tournament", "weapon", "wear", "slug") SELECT "external_id", "family_id", "finish", "id", "image", "kind", "market_hash_name", "ru_skin_name", "ru_weapon", "skin_name", "souvenir", "star", "stattrak", "sticker_name", "sticker_type", "tournament", "weapon", "wear", "market_hash_name" FROM "market_items";
DROP TABLE "market_items";
ALTER TABLE "new_market_items" RENAME TO "market_items";
CREATE UNIQUE INDEX "market_items_external_id_key" ON "market_items"("external_id");
CREATE UNIQUE INDEX "market_items_market_hash_name_key" ON "market_items"("market_hash_name");
CREATE UNIQUE INDEX "market_items_slug_key" ON "market_items"("slug");
CREATE INDEX "market_items_kind_idx" ON "market_items"("kind");
CREATE INDEX "market_items_family_id_idx" ON "market_items"("family_id");
CREATE INDEX "market_items_family_id_wear_stattrak_souvenir_idx" ON "market_items"("family_id", "wear", "stattrak", "souvenir");
CREATE INDEX "market_items_family_id_finish_idx" ON "market_items"("family_id", "finish");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
