-- CreateTable
CREATE TABLE "price_profiles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "price_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "price_profiles_user_id_idx" ON "price_profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "price_profiles_user_id_name_key" ON "price_profiles"("user_id", "name");
