import "server-only";

// Предохранитель, а не тихий срез: до него доходит только явно ненормальный
// объём, и о нём сообщают в интерфейсе.
export const MAX_DEAL_ROWS = 50_000;
const BATCH = 1000;

/**
 * Выбирает все строки постранично по курсору.
 *
 * Раньше выборка была `take: 5000` **без `orderBy`**: порядок не гарантирован,
 * а усечение происходило до фильтрации и сортировки — у пользователя с 6000
 * сделок дашборд считал прибыль по случайной тысяче, молча. Курсор по `id`
 * даёт детерминированный порядок обхода и полный охват.
 */
export async function loadAllByCursor<T extends { id: string }>(
  fetchPage: (cursor: string | undefined, take: number) => Promise<T[]>,
  limit = MAX_DEAL_ROWS,
): Promise<{ rows: T[]; truncated: boolean }> {
  const rows: T[] = [];
  let cursor: string | undefined;

  while (rows.length < limit) {
    const take = Math.min(BATCH, limit - rows.length);
    const page = await fetchPage(cursor, take);
    rows.push(...page);
    if (page.length < take) return { rows, truncated: false };
    cursor = page[page.length - 1].id;
  }
  // Дошли до потолка — значит, что-то ещё осталось.
  const more = await fetchPage(cursor, 1);
  return { rows, truncated: more.length > 0 };
}
