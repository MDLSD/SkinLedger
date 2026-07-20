"use server";

import * as XLSX from "xlsx";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { dealData } from "@/lib/deal-data";
import { dealSchema } from "@/lib/validation";
import { fxFactor } from "@/lib/currency";
import { getRates } from "@/lib/rates";
import { parseCsv, parseStatus, type CsvKey } from "@/lib/deal-csv";
import {
  looksLikeHeader,
  mapHeaders,
  parseDate,
  splitNameQuality,
} from "@/lib/deal-import";

export type ImportState = {
  error?: string;
  imported?: number;
  skipped?: number;
  rowErrors?: { row: number; message: string }[];
};

const MAX_BYTES = 5_000_000;
const MAX_ROWS = 5000;
const DEFAULT_PLATFORM = "Не указана";
const TODAY = () => new Date().toISOString().slice(0, 10);

function toNumberStr(raw: string): string {
  // Убираем валютные символы/пробелы; десятичная запятая → точка.
  return raw
    .replace(/[₽$€¥\s ]/g, "")
    .replace(",", ".")
    .replace(/[^0-9.\-]/g, "")
    .trim();
}

// Приводим таблицу (файл или текст) к матрице строк.
async function readRows(
  file: File | null,
  text: string,
): Promise<string[][]> {
  if (file && file.size > 0) {
    const name = file.name.toLowerCase();
    if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
      const buf = Buffer.from(await file.arrayBuffer());
      const wb = XLSX.read(buf, { type: "buffer" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      if (!sheet) return [];
      const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
        header: 1,
        raw: false,
        defval: "",
        blankrows: false,
      });
      return rows.map((r) => (r as unknown[]).map((c) => String(c ?? "").trim()));
    }
    // Всё остальное считаем текстом (CSV и пр.).
    const { rows } = parseCsv(await file.text());
    return rows;
  }
  if (text.trim()) {
    const { rows } = parseCsv(text);
    return rows;
  }
  return [];
}

export async function importDealsAction(
  _prev: ImportState,
  formData: FormData,
): Promise<ImportState> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Не авторизован" };
  const userId = session.user.id;

  const fileEntry = formData.get("file");
  const file = fileEntry instanceof File ? fileEntry : null;
  const text = formData.get("text")?.toString() ?? "";

  if ((!file || file.size === 0) && !text.trim()) {
    return { error: "Загрузите файл или вставьте текст таблицы" };
  }
  if (file && file.size > MAX_BYTES) {
    return { error: "Файл слишком большой (максимум 5 МБ)" };
  }

  let rows: string[][];
  try {
    rows = await readRows(file, text);
  } catch {
    return { error: "Не удалось прочитать файл. Поддерживаются .xlsx, .csv и текст." };
  }
  if (rows.length < 2) {
    return { error: "Нужны заголовок и хотя бы одна строка данных" };
  }

  // Первая непустая строка — заголовок. Проверяем, что она распознаётся.
  const headerRow = rows[0];
  if (!looksLikeHeader(headerRow)) {
    return {
      error:
        "Не удалось распознать колонки. Добавьте строку заголовков (например «Название», «Цена покупки», «Дата покупки») — можно скачать шаблон.",
    };
  }
  const colIndex = mapHeaders(headerRow);
  if (!colIndex.has("itemName") || !colIndex.has("buyPrice")) {
    return {
      error:
        "Не найдены обязательные колонки с названием и ценой покупки. Проверьте заголовки или скачайте шаблон.",
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

  const [{ baseCurrency }, { rates }] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { baseCurrency: true },
    }),
    getRates(),
  ]);

  // Резолв площадок по имени с кэшем (недостающие создаём как пользовательские).
  const visible = await prisma.platform.findMany({
    where: { OR: [{ isCustom: false }, { userId }] },
  });
  const platformByName = new Map<string, string>();
  for (const p of visible) platformByName.set(p.name.trim().toLowerCase(), p.id);

  async function resolvePlatform(rawName: string): Promise<string> {
    const name = rawName.trim() || DEFAULT_PLATFORM;
    const key = name.toLowerCase();
    const existing = platformByName.get(key);
    if (existing) return existing;
    const created = await prisma.platform.create({
      data: {
        userId,
        name,
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
    const fileRow = idx + 2; // +заголовок, +1-индексация
    try {
      // Название + качество: качество может быть в скобках прямо в названии.
      const { name, quality: nameQuality } = splitNameQuality(cell(row, "itemName"));
      if (!name) {
        rowErrors.push({ row: fileRow, message: "Пустое название" });
        continue;
      }
      const quality = cell(row, "itemQuality") || nameQuality || "";

      const buyPlatformId = await resolvePlatform(cell(row, "buyPlatform"));

      const sellPriceRaw = cell(row, "sellPrice");
      const status =
        parseStatus(cell(row, "status")) ?? (sellPriceRaw ? "sold" : "holding");

      let sellPlatformId = "";
      if (status !== "holding") {
        sellPlatformId = await resolvePlatform(cell(row, "sellPlatform"));
      }

      // Дата покупки: разные форматы; при отсутствии — сегодня.
      const buyDate = parseDate(cell(row, "buyDate")) ?? TODAY();
      const sellDate = parseDate(cell(row, "sellDate")) ?? "";

      const obj: Record<string, string> = {
        itemName: name,
        itemQuality: quality,
        quantity: cell(row, "quantity") || "1",
        buyPlatformId,
        buyPrice: toNumberStr(cell(row, "buyPrice")),
        buyCurrency: (cell(row, "buyCurrency") || "RUB").toUpperCase(),
        buyFeePct: toNumberStr(cell(row, "buyFeePct")) || "0",
        buyDate,
        status,
        sellPlatformId,
        sellPrice: toNumberStr(sellPriceRaw),
        sellCurrency: (
          cell(row, "sellCurrency") || cell(row, "buyCurrency") || "RUB"
        ).toUpperCase(),
        sellFeePct: toNumberStr(cell(row, "sellFeePct")) || "0",
        sellDate: status !== "holding" ? sellDate || buyDate : "",
        note: cell(row, "note"),
        stattrak: "false",
        souvenir: "false",
      };

      const parsed = dealSchema.safeParse(obj);
      if (!parsed.success) {
        rowErrors.push({ row: fileRow, message: parsed.error.issues[0].message });
        continue;
      }

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
