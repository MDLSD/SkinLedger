// Простой in-memory rate limiter.
// Ограничение: память процесса — не переживает рестарт и не разделяется
// между инстансами. На этапе деплоя (serverless) заменить на общее
// хранилище (таблица в Postgres или Upstash Redis).

const buckets = new Map<string, { count: number; resetAt: number }>();

// Протухшие бакеты раньше не удалялись: liveBucket возвращал null, но запись
// оставалась, а recordFailure перезаписывал только тот же ключ. Перебор
// с уникальными email'ами оставлял по записи на каждый — рост без границ.
let lastSweep = 0;
const SWEEP_INTERVAL_MS = 60_000;

function sweep(now: number): void {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

function liveBucket(key: string) {
  const now = Date.now();
  sweep(now);
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    // Ключ, у которого окно истекло, дальше не нужен.
    if (bucket) buckets.delete(key);
    return null;
  }
  return bucket;
}

/** Размер таблицы счётчиков — для проверок и диагностики. */
export function bucketCount(): number {
  return buckets.size;
}

/** Проверка без инкремента: не превышен ли лимит по ключу. */
export function checkLimit(
  key: string,
  limit: number,
): { limited: boolean; retryAfterSec: number } {
  const bucket = liveBucket(key);
  if (!bucket || bucket.count < limit) return { limited: false, retryAfterSec: 0 };
  return {
    limited: true,
    retryAfterSec: Math.ceil((bucket.resetAt - Date.now()) / 1000),
  };
}

/** Зафиксировать неудачную попытку (создаёт окно, если его нет). */
export function recordFailure(key: string, windowMs: number): void {
  const bucket = liveBucket(key);
  if (!bucket) {
    buckets.set(key, { count: 1, resetAt: Date.now() + windowMs });
  } else {
    bucket.count += 1;
  }
}

/** Сбросить счётчик (после успешного входа). */
export function clearLimit(key: string): void {
  buckets.delete(key);
}
