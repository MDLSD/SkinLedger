"use server";

import * as XLSX from "xlsx";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
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

const MAX_BYTES = 5_000_000;
const MAX_ROWS = 5000;
const DEFAULT_PLATFORM = "Не указана";
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

// Лист с наиболее «читаемым» заголовком (иначе первый).
function pickBestSheet(wb: XLSX.WorkBook): string {
  let best = wb.SheetNames[0];
  let bestScore = -1;
  for (const sn of wb.SheetNames) {
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

  let payload: { rows: string[][]; mapping: FieldMapping; options: ImportOptions };
  try {
    payload = JSON.parse(formData.get("payload")?.toString() ?? "");
  } catch {
    return { error: "Некорректные данные импорта" };
  }
  const rows = payload.rows ?? [];
  const mapping = payload.mapping ?? {};
  const options = payload.options ?? { currency: "RUB", dateOrder: "dmy" };

  if (mapping.itemName == null || mapping.buyPrice == null) {
    return { error: "Укажите колонки «Название» и «Цена покупки»" };
  }
  if (!rows.length) return { error: "Нет строк для импорта" };
  if (rows.length > MAX_ROWS) {
    return { error: `Слишком много строк (максимум ${MAX_ROWS})` };
  }

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
      const buyPlatformId = await resolvePlatform(f.buyPlatform);
      let sellPlatformId = "";
      if (f.status !== "holding") sellPlatformId = await resolvePlatform(f.sellPlatform);
      if (f.buyDateMissing) datesDefaulted++;
      if (f.currencyDefaulted) curDefaulted++;

      const obj: Record<string, string> = {
        itemName: f.itemName,
        itemQuality: f.itemQuality,
        quantity: f.quantity || "1",
        buyPlatformId,
        buyPrice: f.buyPrice,
        buyCurrency: f.buyCurrency,
        buyFeePct: f.buyFeePct || "0",
        buyDate: f.buyDate || TODAY(),
        status: f.status,
        sellPlatformId,
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

      parsed.data.buyFxRate = fxFactor(parsed.data.buyCurrency, baseCurrency, rates);
      const sellCur = parsed.data.sellCurrency ?? parsed.data.buyCurrency;
      parsed.data.sellFxRate = fxFactor(sellCur, baseCurrency, rates);

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

export async function undoImportAction(
  _prev: UndoState,
  formData: FormData,
): Promise<UndoState> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Не авторизован" };
  let ids: string[];
  try {
    ids = JSON.parse(formData.get("ids")?.toString() ?? "[]");
  } catch {
    return { error: "Нет данных для отката" };
  }
  if (!Array.isArray(ids) || ids.length === 0) return { error: "Нечего откатывать" };

  const res = await prisma.deal.deleteMany({
    where: { userId: session.user.id, id: { in: ids } },
  });
  revalidatePath("/app/deals");
  revalidatePath("/app");
  return { undone: res.count };
}
