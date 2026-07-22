import bcrypt from "bcryptjs";

// OWASP рекомендует cost 12. Стоимость зашита в сам хеш, поэтому старые хеши
// с cost 10 остаются валидными — но их надо поднять при первом же успешном
// входе: иначе они живут вечно, а разница в стоимости сравнения выдаёт
// существование аккаунта по времени ответа (см. DUMMY_HASH).
export const BCRYPT_COST = 12;

/**
 * Хеш заведомо недостижимого пароля той же стоимости, что и настоящие.
 * Сравнение с ним при несуществующем email стоит столько же, сколько
 * с настоящим хешем, поэтому по времени ответа аккаунты не перечислить.
 */
export const DUMMY_HASH =
  "$2b$12$C6UzMDM.H6dfI/f/IKcEe.7ff5vhLLBhFqQxdOWZ.uy3aFrIiJyGa";

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

/** Хеш слабее текущей стоимости — его пора пересчитать. */
export function needsRehash(hash: string): boolean {
  const cost = Number(hash.split("$")[2]);
  return !Number.isFinite(cost) || cost < BCRYPT_COST;
}
