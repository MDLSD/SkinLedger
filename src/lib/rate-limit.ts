// Простой in-memory rate limiter.
// Ограничение: память процесса — не переживает рестарт и не разделяется
// между инстансами. На этапе деплоя (serverless) заменить на общее
// хранилище (таблица в Postgres или Upstash Redis).

const buckets = new Map<string, { count: number; resetAt: number }>();

function liveBucket(key: string) {
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= Date.now()) return null;
  return bucket;
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
