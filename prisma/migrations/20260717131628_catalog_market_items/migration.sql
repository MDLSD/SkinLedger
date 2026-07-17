-- DropIndex
DROP INDEX "skins_skin_family_id_wear_stattrak_souvenir_idx";

-- DropIndex
DROP INDEX "skins_weapon_skin_name_idx";

-- DropIndex
DROP INDEX "skins_skin_family_id_idx";

-- DropIndex
DROP INDEX "skins_market_hash_name_key";

-- DropIndex
DROP INDEX "skins_external_id_key";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "skins";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "market_items" (
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
    "image" TEXT,
    "ru_weapon" TEXT,
    "ru_skin_name" TEXT
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_deals" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "item_name" TEXT NOT NULL,
    "item_quality" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "buy_platform_id" TEXT NOT NULL,
    "buy_price" DECIMAL NOT NULL,
    "buy_currency" TEXT NOT NULL DEFAULT 'RUB',
    "buy_fx_rate" DECIMAL NOT NULL DEFAULT 1,
    "buy_fee_pct" DECIMAL NOT NULL DEFAULT 0,
    "buy_date" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'holding',
    "sell_platform_id" TEXT,
    "sell_price" DECIMAL,
    "sell_currency" TEXT,
    "sell_fx_rate" DECIMAL,
    "sell_fee_pct" DECIMAL,
    "sell_date" DATETIME,
    "withdrawal_discount_pct" DECIMAL,
    "note" TEXT,
    "item_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "deals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "deals_buy_platform_id_fkey" FOREIGN KEY ("buy_platform_id") REFERENCES "platforms" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "deals_sell_platform_id_fkey" FOREIGN KEY ("sell_platform_id") REFERENCES "platforms" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "deals_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "market_items" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_deals" ("buy_currency", "buy_date", "buy_fee_pct", "buy_fx_rate", "buy_platform_id", "buy_price", "created_at", "id", "item_name", "item_quality", "note", "quantity", "sell_currency", "sell_date", "sell_fee_pct", "sell_fx_rate", "sell_platform_id", "sell_price", "status", "updated_at", "user_id", "withdrawal_discount_pct") SELECT "buy_currency", "buy_date", "buy_fee_pct", "buy_fx_rate", "buy_platform_id", "buy_price", "created_at", "id", "item_name", "item_quality", "note", "quantity", "sell_currency", "sell_date", "sell_fee_pct", "sell_fx_rate", "sell_platform_id", "sell_price", "status", "updated_at", "user_id", "withdrawal_discount_pct" FROM "deals";
DROP TABLE "deals";
ALTER TABLE "new_deals" RENAME TO "deals";
CREATE INDEX "deals_user_id_status_idx" ON "deals"("user_id", "status");
CREATE INDEX "deals_user_id_buy_date_idx" ON "deals"("user_id", "buy_date");
CREATE INDEX "deals_user_id_sell_date_idx" ON "deals"("user_id", "sell_date");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "market_items_external_id_key" ON "market_items"("external_id");

-- CreateIndex
CREATE UNIQUE INDEX "market_items_market_hash_name_key" ON "market_items"("market_hash_name");

-- CreateIndex
CREATE INDEX "market_items_kind_idx" ON "market_items"("kind");

-- CreateIndex
CREATE INDEX "market_items_family_id_idx" ON "market_items"("family_id");

-- CreateIndex
CREATE INDEX "market_items_family_id_wear_stattrak_souvenir_idx" ON "market_items"("family_id", "wear", "stattrak", "souvenir");

-- CreateIndex
CREATE INDEX "market_items_family_id_finish_idx" ON "market_items"("family_id", "finish");

