-- CreateTable
CREATE TABLE "market_sources" (
    "slug" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "buy_fee_pct" DECIMAL NOT NULL DEFAULT 0,
    "sell_fee_pct" DECIMAL NOT NULL DEFAULT 0,
    "withdraw_fee_pct" DECIMAL NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "price_quotes" (
    "market_hash_name" TEXT NOT NULL,
    "source_slug" TEXT NOT NULL,
    "price_min" DECIMAL,
    "price_order" DECIMAL,
    "price_avg_30" DECIMAL,
    "price_median_30" DECIMAL,
    "offers_count" INTEGER,
    "sales_30d" INTEGER,
    "fetched_at" DATETIME NOT NULL,

    PRIMARY KEY ("market_hash_name", "source_slug"),
    CONSTRAINT "price_quotes_source_slug_fkey" FOREIGN KEY ("source_slug") REFERENCES "market_sources" ("slug") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "price_history" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "market_hash_name" TEXT NOT NULL,
    "source_slug" TEXT NOT NULL,
    "price" DECIMAL NOT NULL,
    "ts" DATETIME NOT NULL,
    CONSTRAINT "price_history_source_slug_fkey" FOREIGN KEY ("source_slug") REFERENCES "market_sources" ("slug") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "price_quotes_source_slug_idx" ON "price_quotes"("source_slug");

-- CreateIndex
CREATE INDEX "price_quotes_market_hash_name_idx" ON "price_quotes"("market_hash_name");

-- CreateIndex
CREATE INDEX "price_history_market_hash_name_source_slug_ts_idx" ON "price_history"("market_hash_name", "source_slug", "ts");
