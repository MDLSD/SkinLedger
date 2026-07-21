import { z } from "zod";

export const CURRENCIES = ["RUB", "USD", "EUR", "CNY"] as const;
export const BASE_CURRENCIES = ["RUB", "USD", "EUR"] as const;
export const DEAL_STATUSES = ["holding", "sold", "withdrawn_via_skin"] as const;
export const ITEM_KINDS = [
  "skin", "sticker", "agent", "case", "capsule", "container",
  "keychain", "patch", "graffiti", "music_kit", "collectible",
] as const;

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

// --- Сделки ---

const emptyToUndef = (v: unknown) =>
  v === "" || v == null ? undefined : v;

const optionalNumber = (schema: z.ZodType<number>) =>
  z.preprocess(emptyToUndef, schema.optional());

const requiredPrice = (msg: string) =>
  z.coerce.number({ error: msg }).positive(msg);

const feePct = z.coerce
  .number({ error: "Комиссия — число от 0 до 100" })
  .min(0, "Комиссия не может быть меньше 0")
  .max(100, "Комиссия не может быть больше 100");

const fxRate = z.coerce
  .number({ error: "Курс должен быть числом" })
  .positive("Курс должен быть больше 0");

export const dealSchema = z
  .object({
    itemName: z.string().trim().min(1, "Укажите название скина").max(200),
    itemQuality: z.preprocess(
      emptyToUndef,
      z.string().trim().max(100).optional(),
    ),
    quantity: z.coerce
      .number({ error: "Количество — целое число от 1" })
      .int("Количество — целое число")
      .min(1, "Количество — минимум 1"),

    buyPlatformId: z.string().min(1, "Выберите площадку покупки"),
    buyPrice: requiredPrice("Цена покупки должна быть больше 0"),
    buyCurrency: z.enum(CURRENCIES),
    // Курс к базовой валюте вычисляет сервер из парсера; форма его не шлёт.
    buyFxRate: optionalNumber(fxRate),
    buyFeePct: feePct,
    buyDate: z.coerce.date({ error: "Укажите дату покупки" }),

    status: z.enum(DEAL_STATUSES),

    sellPlatformId: z.preprocess(emptyToUndef, z.string().optional()),
    sellPrice: optionalNumber(requiredPrice("Цена продажи должна быть больше 0")),
    sellCurrency: z.preprocess(emptyToUndef, z.enum(CURRENCIES).optional()),
    sellFxRate: optionalNumber(fxRate),
    sellFeePct: optionalNumber(feePct),
    sellDate: z.preprocess(emptyToUndef, z.coerce.date().optional()),

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
    const label = d.status === "sold" ? "продажи" : "вывода";
    if (!d.sellPlatformId)
      ctx.addIssue({ code: "custom", path: ["sellPlatformId"], message: `Выберите площадку ${label}` });
    if (d.sellPrice == null)
      ctx.addIssue({ code: "custom", path: ["sellPrice"], message: `Укажите цену ${label}` });
    if (d.sellDate == null)
      ctx.addIssue({ code: "custom", path: ["sellDate"], message: `Укажите дату ${label}` });
    if (d.sellDate && d.sellDate < d.buyDate)
      ctx.addIssue({ code: "custom", path: ["sellDate"], message: "Дата продажи не может быть раньше даты покупки" });
  });

export type DealInput = z.infer<typeof dealSchema>;
