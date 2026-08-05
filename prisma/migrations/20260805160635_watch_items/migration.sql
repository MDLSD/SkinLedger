-- CreateTable
CREATE TABLE "watch_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "market_hash_name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "watch_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "watch_items_user_id_kind_idx" ON "watch_items"("user_id", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "watch_items_user_id_market_hash_name_key" ON "watch_items"("user_id", "market_hash_name");
