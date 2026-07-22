"use server";

import * as XLSX from "xlsx";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { checkLimit, recordFailure } from "@/lib/rate-limit";
import { dealData } from "@/lib/deal-data";
import { dealSchema } from "@/lib/validation";
import { fxFactor } from "@/lib/currency";
import { getRates } from "@/lib/rates";
import { parseCsv } from "@/lib/deal-csv";
import {
  detectCurrency,
  detectDateOrder,
  detectFlagColumn,
  detectHeaderRow,
  guessMappingByValues,
  isJunkRow,
  mapColumns,
  rowToFields,
  type AnalyzeState,
  type CommitState,
  type FieldMapping,
  type ImportOptions,
  type UndoState,
} from "@/lib/deal-import";

// Разбор xlsx в память и до 5000 INSERT'ов — самые дорогие операции
// приложения, а лимитера на них не было вовсе.
const IMPORT_LIMIT = 20;
const IMPORT_WINDOW_MS = 10 * 60_000;

async function importLimit(userId: string): Promise<string | null> {
  const key = `import:user:${userId}`;
  const limit = checkLimit(key, IMPORT_LIMIT);
  if (limit.limited) {
    return `Слишком много импортов. Повторите через ${Math.ceil(limit.retryAfterSec / 60)} мин.`;
  }
  recordFailure(key, IMPORT_WINDOW_MS);
  return null;
}

const MAX_BYTES = 5_000_000;
const MAX_ROWS = 5000;
const DEFAULT_PLATFORM = "Не указана";
// Импорт создаёт площадки по названиям из файла. Без потолка одна ошибка
// в сопоставлении колонок (например, площадка указывает на колонку заметок)
// заводит по площадке на строку — до 10 000 записей за запрос, повторяемо.
const MAX_PLATFORMS = 100;
const platformNameSchema = z.string().trim().min(1).max(80);
// Строки приходят из клиентского payload, а не из разобранного сервером файла.
const rowsSchema = z.array(z.array(z.string())).min(1).max(MAX_ROWS);
const TODAY = () => new Date().toISOString().slice(0, 10);

// UTF-8, а при невалидных последовательностях — windows-1251 (частый результат
// «Сохранить как CSV» в русском Excel).
function decodeBuffer(buf: Buffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buf);
  } catch {
    try {
      return new TextDecoder("windows-1251").decode(buf);
    } catch {
      return buf.toString("utf-8");
    }
  }
}

function sheetToMatrix(sheet: XLSX.WorkSheet): string[][] {
  return XLSX.utils
    .sheet_to_json<unknown[]>(sheet, {
      header: 1,
      raw: false,
      defval: "",
      blankrows: false,
    })
    .map((r) => (r as unknown[]).map((c) => String(c ?? "").trim()));
}

// Распаковка xlsx даёт амплификацию: маленький архив разворачивается
// в много листов, а прогонять sheetToMatrix по всем — дорого.
const MAX_SHEETS = 20;

// Лист с наиболее «читаемым» заголовком (иначе первый).
function pickBestSheet(wb: XLSX.WorkBook): string {
  let best = wb.SheetNames[0];
  let bestScore = -1;
  for (const sn of wb.SheetNames.slice(0, MAX_SHEETS)) {
    const m = sheetToMatrix(wb.Sheets[sn]);
    const hi = detectHeaderRow(m);
    const score = hi >= 0 ? Object.keys(mapColumns(m[hi], m.slice(hi + 1, hi + 8))).length + 100 : 0;
    if (score > bestScore) {
      bestScore = score;
      best = sn;
    }
  }
  return best;
}

async function readMatrix(
  file: File | null,
  text: string,
  sheetSel: string,
): Promise<{ matrix: string[][]; sheetNames: string[]; sheet: string }> {
  if (file && file.size > 0) {
    const name = file.name.toLowerCase();
    const buf = Buffer.from(await file.arrayBuffer());
    if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
      const wb = XLSX.read(buf, { type: "buffer" });
      const sheetNames = wb.SheetNames;
      const sheet =
        sheetSel && sheetNames.includes(sheetSel) ? sheetSel : pickBestSheet(wb);
      const ws = wb.Sheets[sheet];
      return { matrix: ws ? sheetToMatrix(ws) : [], sheetNames, sheet };
    }
    return { matrix: parseCsv(decodeBuffer(buf)).rows, sheetNames: [], sheet: "" };
  }
  if (text.trim()) return { matrix: parseCsv(text).rows, sheetNames: [], sheet: "" };
  return { matrix: [], sheetNames: [], sheet: "" };
}

// ---------- Шаг 1: анализ файла/текста → превью ----------

export async function analyzeImportAction(
  _prev: AnalyzeState,
  formData: FormData,
): Promise<AnalyzeState> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Не авторизован" };
  const limited = await importLimit(session.user.id);
  if (limited) return { error: limited };

  const fileEntry = formData.get("file");
  const file = fileEntry instanceof File ? fileEntry : null;
  const text = formData.get("text")?.toString() ?? "";
  const sheetSel = formData.get("sheet")?.toString() ?? "";

  if ((!file || file.size === 0) && !text.trim()) {
    return { error: "Загрузите файл или вставьте текст таблицы" };
  }
  if (file && file.size > MAX_BYTES) {
    return { error: "Файл слишком большой (максимум 5 МБ)" };
  }

  let matrix: string[][];
  let sheetNames: string[];
  let sheet: string;
  try {
    ({ matrix, sheetNames, sheet } = await readMatrix(file, text, sheetSel));
  } catch {
    return { error: "Не удалось прочитать файл. Поддерживаются .xlsx, .csv и текст." };
  }
  matrix = matrix.filter((r) => r.some((c) => c.trim() !== ""));
  if (matrix.length < 1) return { error: "Файл пустой" };

  const notes: string[] = [];
  const headerRowIndex = detectHeaderRow(matrix);
  let headers: string[];
  let dataRows: string[][];
  let mapping: FieldMapping;
  let headerFound: boolean;

  if (headerRowIndex >= 0) {
    headerFound = true;
    headers = matrix[headerRowIndex];
    dataRows = matrix.slice(headerRowIndex + 1).filter((r) => !isJunkRow(r));
    mapping = mapColumns(headers, dataRows.slice(0, 20));
    if (headerRowIndex > 0)
      notes.push(
        `Заголовок найден на строке ${headerRowIndex + 1} — строки выше пропущены.`,
      );
  } else {
    headerFound = false;
    dataRows = matrix.filter((r) => !isJunkRow(r));
    const ncols = dataRows.reduce((n, r) => Math.max(n, r.length), 0);
    headers = Array.from({ length: ncols }, (_, i) => `Столбец ${i + 1}`);
    mapping = guessMappingByValues(dataRows.slice(0, 20));
    notes.push(
      "Строка заголовков не найдена — колонки определены по значениям, проверьте сопоставление ниже.",
    );
  }
  if (dataRows.length === 0) return { error: "Не нашлось строк с данными" };
  if (dataRows.length > MAX_ROWS) {
    dataRows = dataRows.slice(0, MAX_ROWS);
    notes.push(`Взяты первые ${MAX_ROWS} строк.`);
  }

  const colVals = (col: number) =>
    dataRows.map((r) => (r[col] ?? "").trim()).filter(Boolean).slice(0, 60);

  const currencyDetected =
    mapping.buyPrice != null ? detectCurrency(colVals(mapping.buyPrice)) : null;
  const { baseCurrency } = await prisma.user.findUniqueOrThrow({
    where: { id: session.user.id },
    select: { baseCurrency: true },
  });
  const currency = currencyDetected ?? baseCurrency;
  if (currencyDetected) notes.push(`Валюта определена по символам: ${currencyDetected}.`);

  const dateOrder =
    mapping.buyDate != null ? detectDateOrder(colVals(mapping.buyDate)) : "dmy";
  if (dateOrder === "mdy") notes.push("Похоже, даты в формате ММ/ДД (US) — учтено.");

  const flagCol = detectFlagColumn(headers);
  const options: ImportOptions = { currency, dateOrder, flagCol };

  if (sheetNames.length > 1) notes.push(`Импортируется лист «${sheet}».`);

  return {
    ok: true,
    headers,
    rows: dataRows,
    mapping,
    options,
    headerFound,
    sheetNames,
    sheet,
    currencyDetected,
    notes,
  };
}

// ---------- Шаг 2: импорт по подтверждённому сопоставлению ----------

export async function commitImportAction(
  _prev: CommitState,
  formData: FormData,
): Promise<CommitState> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Не авторизован" };
  const userId = session.user.id;
  const limited = await importLimit(userId);
  if (limited) return { error: limited };

  let payload: { rows: string[][]; mapping: FieldMapping; options: ImportOptions };
  try {
    payload = JSON.parse(formData.get("payload")?.toString() ?? "");
  } catch {
    return { error: "Некорректные данные импорта" };
  }
  const mapping = payload.mapping ?? {};
  const options = payload.options ?? { currency: "RUB", dateOrder: "dmy" };

  if (mapping.itemName == null || mapping.buyPrice == null) {
    return { error: "Укажите колонки «Название» и «Цена покупки»" };
  }
  const parsedRows = rowsSchema.safeParse(payload.rows ?? []);
  if (!parsedRows.success) {
    return { error: `Нет строк для импорта или их больше ${MAX_ROWS}` };
  }
  const rows = parsedRows.data;

  const [{ baseCurrency }, { rates }] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { baseCurrency: true },
    }),
    getRates(),
  ]);

  const visible = await prisma.platform.findMany({
    where: { OR: [{ isCustom: false }, { userId }] },
  });
  const platformByName = new Map<string, string>();
  let ownCount = 0;
  for (const p of visible) {
    platformByName.set(p.name.trim().toLowerCase(), p.id);
    if (p.userId === userId) ownCount++;
  }

  type Resolved = { id: string } | { error: string };

  async function resolvePlatform(rawName: string): Promise<Resolved> {
    const parsed = platformNameSchema.safeParse(rawName.trim() || DEFAULT_PLATFORM);
    if (!parsed.success) return { error: "Некорректное название площадки" };
    const name = parsed.data;
    const key = name.toLowerCase();
    const existing = platformByName.get(key);
    if (existing) return { id: existing };
    if (ownCount >= MAX_PLATFORMS) {
      return { error: `Достигнут лимит площадок (${MAX_PLATFORMS})` };
    }
    const created = await prisma.platform.create({
      data: {
        userId,
        name,
        isCustom: true,
        defaultBuyFeePct: 0,
        defaultSellFeePct: 0,
      },
    });
    ownCount++;
    platformByName.set(key, created.id);
    return { id: created.id };
  }

  let imported = 0;
  const createdIds: string[] = [];
  const rowErrors: { row: number; message: string }[] = [];
  let datesDefaulted = 0;
  let curDefaulted = 0;

  for (let idx = 0; idx < rows.length; idx++) {
    const fileRow = idx + 1;
    try {
      const f = rowToFields(rows[idx], mapping, options);
      if (!f.itemName) {
        rowErrors.push({ row: fileRow, message: "Пустое название" });
        continue;
      }
      // Площадки резолвятся ПОСЛЕ валидации строки: иначе битая строка всё
      // равно оставляла после себя созданную площадку. Здесь — заглушки,
      // чтобы схема не ругалась на пустой id.
      const obj: Record<string, string> = {
        itemName: f.itemName,
        itemQuality: f.itemQuality,
        quantity: f.quantity || "1",
        buyPlatformId: "-",
        buyPrice: f.buyPrice,
        buyCurrency: f.buyCurrency,
        buyFeePct: f.buyFeePct || "0",
        buyDate: f.buyDate || TODAY(),
        status: f.status,
        sellPlatformId: f.status !== "holding" ? "-" : "",
        sellPrice: f.sellPrice,
        sellCurrency: f.sellCurrency,
        sellFeePct: f.sellFeePct || "0",
        sellDate: f.status !== "holding" ? f.sellDate || f.buyDate || TODAY() : "",
        note: f.note,
        stattrak: "false",
        souvenir: "false",
      };

      const parsed = dealSchema.safeParse(obj);
      if (!parsed.success) {
        let msg = parsed.error.issues[0].message;
        if (/раньше даты покупки/.test(msg))
          msg += " (возможно, перепутан формат даты)";
        rowErrors.push({ row: fileRow, message: msg });
        continue;
      }

      const buy = await resolvePlatform(f.buyPlatform);
      if ("error" in buy) {
        rowErrors.push({ row: fileRow, message: buy.error });
        continue;
      }
      parsed.data.buyPlatformId = buy.id;
      if (f.status !== "holding") {
        const sell = await resolvePlatform(f.sellPlatform);
        if ("error" in sell) {
          rowErrors.push({ row: fileRow, message: sell.error });
          continue;
        }
        parsed.data.sellPlatformId = sell.id;
      }
      if (f.buyDateMissing) datesDefaulted++;
      if (f.currencyDefaulted) curDefaulted++;

      const buyFx = fxFactor(parsed.data.buyCurrency, baseCurrency, rates);
      const sellCur = parsed.data.sellCurrency ?? parsed.data.buyCurrency;
      const sellFx = fxFactor(sellCur, baseCurrency, rates);
      if (buyFx == null || sellFx == null) {
        rowErrors.push({ row: fileRow, message: "Нет курса валюты сделки" });
        continue;
      }
      parsed.data.buyFxRate = buyFx;
      parsed.data.sellFxRate = sellFx;

      const created = await prisma.deal.create({ data: dealData(userId, parsed.data) });
      createdIds.push(created.id);
      imported++;
    } catch {
      rowErrors.push({ row: fileRow, message: "Не удалось импортировать строку" });
    }
  }

  const warnings: string[] = [];
  if (curDefaulted > 0)
    warnings.push(
      `У ${curDefaulted} сделок валюта не указана — принято ${options.currency}.`,
    );
  if (datesDefaulted > 0)
    warnings.push(
      `У ${datesDefaulted} сделок не было даты покупки — подставлена дата продажи или сегодняшняя.`,
    );

  if (imported > 0) {
    revalidatePath("/app/deals");
    revalidatePath("/app");
  }

  return {
    imported,
    skipped: rowErrors.length,
    rowErrors: rowErrors.slice(0, 50),
    warnings,
    createdIds,
  };
}

// ---------- Откат последнего импорта ----------

// SQLite ограничивает число переменных в запросе: `in` на ~999 элементов уже
// падает с P2029, а импорт разрешает до MAX_ROWS строк.
const UNDO_CHUNK = 500;
const undoIdsSchema = z.array(z.uuid()).min(1).max(MAX_ROWS);

export async function undoImportAction(
  _prev: UndoState,
  formData: FormData,
): Promise<UndoState> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Не авторизован" };
  let ids: string[];
  try {
    const parsed = undoIdsSchema.safeParse(JSON.parse(formData.get("ids")?.toString() ?? "[]"));
    if (!parsed.success) return { error: "Нечего откатывать" };
    ids = parsed.data;
  } catch {
    return { error: "Нет данных для отката" };
  }

  let undone = 0;
  try {
    for (let i = 0; i < ids.length; i += UNDO_CHUNK) {
      const res = await prisma.deal.deleteMany({
        where: { userId: session.user.id, id: { in: ids.slice(i, i + UNDO_CHUNK) } },
      });
      undone += res.count;
    }
  } catch (e) {
    console.error("undoImportAction", e);
    return { error: "Не удалось откатить импорт" };
  }

  revalidatePath("/app/deals");
  revalidatePath("/app");
  return { undone };
}
