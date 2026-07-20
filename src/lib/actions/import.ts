"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { dealData } from "@/lib/deal-data";
import { dealSchema } from "@/lib/validation";
import { fxFactor } from "@/lib/currency";
import { getRates } from "@/lib/rates";
import {
  CSV_COLUMNS,
  parseCsv,
  parseStatus,
  type CsvKey,
} from "@/lib/deal-csv";

export type ImportState = {
  error?: string;
  imported?: number;
  skipped?: number;
  // Ошибки построчно: номер строки в файле (с учётом заголовка) + причина.
  rowErrors?: { row: number; message: string }[];
};

// Ограничения на импорт (защита от больших/битых файлов).
const MAX_BYTES = 2_000_000;
const MAX_ROWS = 2000;

// Нормализация заголовка: без регистра, пробелов и хвостовых знаков.
function normHeader(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

const HEADER_TO_KEY = new Map<string, CsvKey>(
  CSV_COLUMNS.map((c) => [normHeader(c.header), c.key]),
);

function toNumberStr(raw: string): string {
  return raw.trim().replace(/\s/g, "").replace(",", ".");
}

export async function importDealsAction(
  _prev: ImportState,
  formData: FormData,
): Promise<ImportState> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Не авторизован" };
  const userId = session.user.id;

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Выберите CSV-файл" };
  }
  if (file.size > MAX_BYTES) {
    return { error: "Файл слишком большой (максимум 2 МБ)" };
  }

  const text = await file.text();
  const { rows } = parseCsv(text);
  if (rows.length < 2) {
    return { error: "В файле нет строк с данными (нужен заголовок + строки)" };
  }

  // Сопоставляем колонки файла с ключами по заголовку.
  const headerRow = rows[0];
  const colIndex = new Map<CsvKey, number>();
  headerRow.forEach((h, i) => {
    const key = HEADER_TO_KEY.get(normHeader(h));
    if (key && !colIndex.has(key)) colIndex.set(key, i);
  });
  if (!colIndex.has("itemName") || !colIndex.has("buyPrice")) {
    return {
      error:
        "Не найдены обязательные колонки «Название» и «Цена покупки». Скачайте шаблон и заполните его.",
    };
  }

  const dataRows = rows.slice(1);
  if (dataRows.length > MAX_ROWS) {
    return { error: `Слишком много строк (максимум ${MAX_ROWS})` };
  }

  const cell = (row: string[], key: CsvKey): string => {
    const i = colIndex.get(key);
    return i == null ? "" : (row[i] ?? "").trim();
  };

  // Курсы и базовая валюта — один раз на весь импорт.
  const [{ baseCurrency }, { rates }] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { baseCurrency: true },
    }),
    getRates(),
  ]);

  // Резолв площадок по имени с кэшем (создаём пользовательские при отсутствии).
  const visible = await prisma.platform.findMany({
    where: { OR: [{ isCustom: false }, { userId }] },
  });
  const platformByName = new Map<string, string>();
  for (const p of visible) platformByName.set(p.name.trim().toLowerCase(), p.id);

  async function resolvePlatform(name: string): Promise<string> {
    const key = name.trim().toLowerCase();
    const existing = platformByName.get(key);
    if (existing) return existing;
    const created = await prisma.platform.create({
      data: {
        userId,
        name: name.trim(),
        isCustom: true,
        defaultBuyFeePct: 0,
        defaultSellFeePct: 0,
      },
    });
    platformByName.set(key, created.id);
    return created.id;
  }

  let imported = 0;
  const rowErrors: { row: number; message: string }[] = [];

  for (let idx = 0; idx < dataRows.length; idx++) {
    const row = dataRows[idx];
    const fileRow = idx + 2; // +1 заголовок, +1 к 1-индексации
    try {
      const buyPlatformName = cell(row, "buyPlatform");
      if (!buyPlatformName) {
        rowErrors.push({ row: fileRow, message: "Не указана площадка покупки" });
        continue;
      }
      const buyPlatformId = await resolvePlatform(buyPlatformName);

      // Статус: явный из файла либо вывод из наличия цены продажи.
      const sellPriceRaw = cell(row, "sellPrice");
      const status =
        parseStatus(cell(row, "status")) ??
        (sellPriceRaw ? "sold" : "holding");

      let sellPlatformId = "";
      if (status !== "holding") {
        const sellPlatformName = cell(row, "sellPlatform");
        if (sellPlatformName) sellPlatformId = await resolvePlatform(sellPlatformName);
      }

      const obj: Record<string, string> = {
        itemName: cell(row, "itemName"),
        itemQuality: cell(row, "itemQuality"),
        quantity: cell(row, "quantity") || "1",
        buyPlatformId,
        buyPrice: toNumberStr(cell(row, "buyPrice")),
        buyCurrency: (cell(row, "buyCurrency") || "RUB").toUpperCase(),
        buyFeePct: toNumberStr(cell(row, "buyFeePct")) || "0",
        buyDate: cell(row, "buyDate"),
        status,
        sellPlatformId,
        sellPrice: toNumberStr(sellPriceRaw),
        sellCurrency: (
          cell(row, "sellCurrency") || cell(row, "buyCurrency") || "RUB"
        ).toUpperCase(),
        sellFeePct: toNumberStr(cell(row, "sellFeePct")) || "0",
        sellDate: cell(row, "sellDate"),
        note: cell(row, "note"),
        stattrak: "false",
        souvenir: "false",
      };

      const parsed = dealSchema.safeParse(obj);
      if (!parsed.success) {
        rowErrors.push({ row: fileRow, message: parsed.error.issues[0].message });
        continue;
      }

      // Курс к базовой валюте — из парсера (как в форме).
      parsed.data.buyFxRate = fxFactor(parsed.data.buyCurrency, baseCurrency, rates);
      const sellCur = parsed.data.sellCurrency ?? parsed.data.buyCurrency;
      parsed.data.sellFxRate = fxFactor(sellCur, baseCurrency, rates);

      await prisma.deal.create({ data: dealData(userId, parsed.data) });
      imported++;
    } catch {
      rowErrors.push({ row: fileRow, message: "Не удалось импортировать строку" });
    }
  }

  if (imported > 0) {
    revalidatePath("/app/deals");
    revalidatePath("/app");
  }

  return { imported, skipped: rowErrors.length, rowErrors: rowErrors.slice(0, 50) };
}
