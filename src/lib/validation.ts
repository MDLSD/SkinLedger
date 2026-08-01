import { z } from "zod";

/**
 * Сообщения схем — это КЛЮЧИ перевода из неймспейса `errors`, а не готовый
 * текст. Схемы лежат на уровне модуля и разделяются клиентом и сервером,
 * поэтому язык им взять неоткуда; перевод делает тот, кто показывает ошибку —
 * через `useErrorMessage()` (src/i18n/error-message.ts).
 */

export const CURRENCIES = ["RUB", "USD", "EUR", "CNY"] as const;
export const BASE_CURRENCIES = ["RUB", "USD", "EUR"] as const;
export const DEAL_STATUSES = ["holding", "sold"] as const;
export const ITEM_KINDS = [
  "skin", "sticker", "agent", "case", "capsule", "container",
  "keychain", "patch", "graffiti", "music_kit", "collectible",
] as const;

export type Currency = (typeof CURRENCIES)[number];
export type BaseCurrency = (typeof BASE_CURRENCIES)[number];
export type DealStatus = (typeof DEAL_STATUSES)[number];

export const registerSchema = z.object({
  email: z.email("email"),
  password: z.string().min(8, "passwordMin"),
});

export const loginSchema = z.object({
  email: z.email("email"),
  password: z.string().min(1, "passwordRequired"),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "currentPasswordRequired"),
    newPassword: z.string().min(8, "newPasswordMin"),
  })
  .refine((d) => d.currentPassword !== d.newPassword, {
    path: ["newPassword"],
    message: "newPasswordSame",
  });

// --- Сделки ---

const emptyToUndef = (v: unknown) =>
  v === "" || v == null ? undefined : v;

const optionalNumber = (schema: z.ZodType<number>) =>
  z.preprocess(emptyToUndef, schema.optional());

// Верхние границы: без них 1e308 проходит как цена, а дальше buyCostBase даёт
// Infinity и все агрегаты дашборда становятся ∞/NaN — необратимо, данные уже в БД.
export const MAX_PRICE = 1e9;
export const MAX_QUANTITY = 100_000;

// z.coerce.number() принимает литералы с префиксом ("0x10" → 16). Для денежных
// полей это не ввод пользователя, а мусор из подделанного запроса.
const decimalOnly = (v: unknown) =>
  typeof v === "string" && /^\s*[+-]?0[xXoObB]/.test(v) ? NaN : v;

const requiredPrice = (msg: string) =>
  z.preprocess(
    decimalOnly,
    z.coerce.number({ error: msg }).positive(msg).max(MAX_PRICE, "amountTooLarge"),
  );

const feePct = z.coerce
  .number({ error: "feeRange" })
  .min(0, "feeMin")
  .max(100, "feeMax");

const fxRate = z.coerce
  .number({ error: "fxNumber" })
  .positive("fxPositive");

// Границы даты сделки. Верхняя проверяется в refine, а не через .max(): значение
// в .max() зафиксировалось бы на момент старта процесса, и на долгоживущем
// сервере «сегодня» со временем стало бы «датой в будущем».
const MIN_DEAL_DATE = new Date("2010-01-01T00:00:00.000Z");
const dealDate = (msg: string) =>
  z.coerce
    .date({ error: msg })
    .min(MIN_DEAL_DATE, "dateTooEarly")
    .refine((d) => d.getTime() <= Date.now() + 86_400_000, "dateInFuture");

export const dealSchema = z
  .object({
    itemName: z.string().trim().min(1, "itemNameRequired").max(200),
    itemQuality: z.preprocess(
      emptyToUndef,
      z.string().trim().max(100).optional(),
    ),
    quantity: z.coerce
      .number({ error: "quantityRange" })
      .int("quantityInt")
      .min(1, "quantityMin")
      .max(MAX_QUANTITY, "quantityTooLarge"),
    // Частичная продажа: сколько штук продано (остаток → в холд).
    // Пусто/отсутствует = продано всё количество.
    sellQuantity: optionalNumber(
      z.coerce.number().int("soldInt").min(1, "soldMin"),
    ),

    buyPlatformId: z.string().min(1, "buyPlatformRequired"),
    buyPrice: requiredPrice("buyPricePositive"),
    buyCurrency: z.enum(CURRENCIES),
    // Курс к базовой валюте вычисляет сервер из парсера; форма его не шлёт.
    buyFxRate: optionalNumber(fxRate),
    buyFeePct: feePct,
    buyDate: dealDate("buyDateRequired"),

    status: z.enum(DEAL_STATUSES),

    sellPlatformId: z.preprocess(emptyToUndef, z.string().optional()),
    sellPrice: optionalNumber(requiredPrice("sellPricePositive")),
    sellCurrency: z.preprocess(emptyToUndef, z.enum(CURRENCIES).optional()),
    sellFxRate: optionalNumber(fxRate),
    sellFeePct: optionalNumber(feePct),
    sellDate: z.preprocess(
      emptyToUndef,
      dealDate("sellDateRequired").optional(),
    ),

    note: z.preprocess(emptyToUndef, z.string().trim().max(2000).optional()),

    // Ссылка на каталог (если предмет выбран из автокомплита).
    skinFamilyId: z.preprocess(emptyToUndef, z.string().optional()),
    itemKind: z.preprocess(emptyToUndef, z.enum(ITEM_KINDS).optional()),
    stattrak: z.preprocess((v) => v === "true" || v === true, z.boolean()),
    souvenir: z.preprocess((v) => v === "true" || v === true, z.boolean()),
    finish: z.preprocess(emptyToUndef, z.string().optional()),
  })
  .superRefine((d, ctx) => {
    if (d.status === "holding") return;
    if (!d.sellPlatformId)
      ctx.addIssue({ code: "custom", path: ["sellPlatformId"], message: "sellPlatformRequired" });
    if (d.sellPrice == null)
      ctx.addIssue({ code: "custom", path: ["sellPrice"], message: "sellPriceRequired" });
    if (d.sellDate == null)
      ctx.addIssue({ code: "custom", path: ["sellDate"], message: "sellDateRequired" });
    if (d.sellDate && d.sellDate < d.buyDate)
      ctx.addIssue({ code: "custom", path: ["sellDate"], message: "sellDateBeforeBuy" });
    if (d.sellQuantity != null && d.sellQuantity > d.quantity)
      ctx.addIssue({ code: "custom", path: ["sellQuantity"], message: "soldExceedsQuantity" });
  });

export type DealInput = z.infer<typeof dealSchema>;
