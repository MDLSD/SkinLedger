/**
 * Разовая заливка истории цен, чтобы график на /app/prices работал сразу.
 * Источник — тот же адаптер, что и у крона (сейчас фейковый; после подключения
 * платного Pricempire достаточно подменить источник здесь).
 *
 * Запуск:  npm run prices:history
 * Глубина: HISTORY_DAYS=180 (по умолчанию 180 дней)
 * Перезалить поверх существующей истории: HISTORY_REPLACE=1
 */
import "dotenv/config";
import { fakeSource } from "../src/lib/prices/fake-source";
import { backfillHistory } from "../src/lib/prices/backfill";

const days = Number(process.env.HISTORY_DAYS ?? 180);
const replace = process.env.HISTORY_REPLACE === "1";

async function main() {
  if (!Number.isFinite(days) || days < 1) {
    throw new Error(`HISTORY_DAYS должен быть положительным числом, получено: ${process.env.HISTORY_DAYS}`);
  }
  console.log(`Заливка истории за ${days} дн.${replace ? " (с перезаписью)" : ""}…`);
  const started = Date.now();

  const res = await backfillHistory(fakeSource(), days, {
    replace,
    onProgress: (done, total) => process.stdout.write(`\r  предметов ${done}/${total}`),
  });
  process.stdout.write("\n");

  console.log(
    `Готово за ${((Date.now() - started) / 1000).toFixed(1)} с: предметов ${res.items}, ` +
      `площадок ${res.sources}, точек ${res.points.toLocaleString("ru-RU")}` +
      (res.deleted ? `, удалено старых ${res.deleted.toLocaleString("ru-RU")}` : ""),
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
