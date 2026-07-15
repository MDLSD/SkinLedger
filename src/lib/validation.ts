import { z } from "zod";

export const CURRENCIES = ["RUB", "USD", "EUR", "CNY"] as const;
export const BASE_CURRENCIES = ["RUB", "USD", "EUR"] as const;
export const DEAL_STATUSES = ["holding", "sold", "withdrawn_via_skin"] as const;

export type Currency = (typeof CURRENCIES)[number];
export type BaseCurrency = (typeof BASE_CURRENCIES)[number];
export type DealStatus = (typeof DEAL_STATUSES)[number];

export const registerSchema = z.object({
  email: z.email("Некорректный email"),
  password: z.string().min(8, "Пароль — минимум 8 символов"),
});

export const loginSchema = z.object({
  email: z.email("Некорректный email"),
  password: z.string().min(1, "Введите пароль"),
});
