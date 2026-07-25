/**
 * Один тик загрузки цен в БД. Сейчас — фейковый источник (нет платной подписки
 * Pricempire). На деплое этот же ingestPrices() дёргает крон.
 *
 * Запуск: npm run prices:ingest
 * Размер выборки: PRICES_SAMPLE=5000 npm run prices:ingest
 */
import "dotenv/config";
import { ensureSources, ingestPrices } from "../src/lib/prices/ingest";
import { fakeSource } from "../src/lib/prices/fake-source";

async function main() {
  console.log("Загрузка цен (фейковый источник)…");
  await ensureSources();
  const t = Date.now();
  const res = await ingestPrices(fakeSource());
  console.log(
    `Готово за ${((Date.now() - t) / 1000).toFixed(1)} с: площадок ${res.sources}, ` +
      `предметов ${res.items}, котировок ${res.quotes}, точек истории ${res.history}.`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
