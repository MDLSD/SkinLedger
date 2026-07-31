// Валюта отображения. Для гостя это cookie (в БД её хранить негде), для
// вошедшего — его основная валюта из настроек: в ней считаются сделки, и
// расходиться с ней на публичных страницах нельзя.
import "server-only";
import { cookies } from "next/headers";
import { BASE_CURRENCIES } from "@/lib/validation";

export const CURRENCY_COOKIE = "cur";
export const DEFAULT_CURRENCY = "RUB";

const isSupported = (v: string): boolean =>
  (BASE_CURRENCIES as readonly string[]).includes(v);

/**
 * Валюта для показа цен. `userCurrency` передаётся там, где пользователь уже
 * загружен (страницы /app), чтобы не ходить в БД второй раз.
 */
export async function displayCurrency(userCurrency?: string | null): Promise<string> {
  if (userCurrency && isSupported(userCurrency)) return userCurrency;
  const value = (await cookies()).get(CURRENCY_COOKIE)?.value ?? "";
  return isSupported(value) ? value : DEFAULT_CURRENCY;
}
