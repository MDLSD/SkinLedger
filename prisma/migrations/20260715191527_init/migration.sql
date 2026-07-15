-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "base_currency" TEXT NOT NULL DEFAULT 'RUB',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "platforms" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "default_sell_fee_pct" DECIMAL NOT NULL DEFAULT 0,
    "default_buy_fee_pct" DECIMAL NOT NULL DEFAULT 0,
    "is_custom" BOOLEAN NOT NULL DEFAULT false,
    "user_id" TEXT,
    CONSTRAINT "platforms_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "deals" (
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
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "deals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "deals_buy_platform_id_fkey" FOREIGN KEY ("buy_platform_id") REFERENCES "platforms" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "deals_sell_platform_id_fkey" FOREIGN KEY ("sell_platform_id") REFERENCES "platforms" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "deals_user_id_status_idx" ON "deals"("user_id", "status");

-- CreateIndex
CREATE INDEX "deals_user_id_buy_date_idx" ON "deals"("user_id", "buy_date");

-- CreateIndex
CREATE INDEX "deals_user_id_sell_date_idx" ON "deals"("user_id", "sell_date");
