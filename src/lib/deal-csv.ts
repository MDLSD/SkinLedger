// CSV-формат сделок для экспорта/импорта (раздел 5.2 ТЗ). Колонки — из 4.3.
// Разделитель `;` (родной для RU-Excel), UTF-8 BOM. Парсер импорта также
// понимает `,` — разделитель определяется по строке заголовка.
import type { DealDTO } from "@/lib/types";

export const BOM = "﻿";

// Ключи соответствуют полям формы/валидации; заголовки — человекочитаемые RU.
export const CSV_COLUMNS = [
  { key: "itemName", header: "Название" },
  { key: "itemQuality", header: "Качество" },
  { key: "quantity", header: "Количество" },
  { key: "buyPlatform", header: "Площадка покупки" },
  { key: "buyPrice", header: "Цена покупки" },
  { key: "buyCurrency", header: "Валюта покупки" },
  { key: "buyFeePct", header: "Комиссия покупки, %" },
  { key: "buyDate", header: "Дата покупки" },
  { key: "status", header: "Статус" },
  { key: "sellPlatform", header: "Площадка продажи" },
  { key: "sellPrice", header: "Цена продажи" },
  { key: "sellCurrency", header: "Валюта продажи" },
  { key: "sellFeePct", header: "Комиссия продажи, %" },
  { key: "sellDate", header: "Дата продажи" },
  { key: "note", header: "Комментарий" },
] as const;

export type CsvKey = (typeof CSV_COLUMNS)[number]["key"];

export const STATUS_RU: Record<string, string> = {
  holding: "в холде",
  sold: "продано",
  withdrawn_via_skin: "вывод",
};

// Разбор статуса из CSV: принимаем RU-подписи, англ. enum и синонимы.
export function parseStatus(raw: string): string | null {
  const s = raw.trim().toLowerCase();
  if (!s) return null; // пусто → выведем из наличия продажи
  if (["в холде", "холд", "holding"].includes(s)) return "holding";
  if (["продано", "продажа", "sold"].includes(s)) return "sold";
  if (["вывод", "выводной", "withdrawn_via_skin", "withdrawn"].includes(s))
    return "withdrawn_via_skin";
  return null;
}

const NUMERIC_CELL = /^-?\d+([.,]\d+)?$/;

function csvCell(value: string, delimiter: string): string {
  if (value === "") return "";
  // Название и заметка — свободный ввод. Ячейка, начинающаяся с =, +, -, @,
  // TAB или CR, в Excel и LibreOffice трактуется как формула: строка
  // `=cmd|'/c calc'!A1` выполнится при открытии выгруженного файла.
  // Ведущий апостроф заставляет считать содержимое текстом. Числа при этом
  // не трогаем: суммы выгружаются с минусом и запятой («-400,5»), и апостроф
  // превратил бы числовую колонку в текстовую.
  const v =
    !NUMERIC_CELL.test(value) && /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  // Экранируем, если есть разделитель, кавычка или перенос строки.
  if (
    v.includes(delimiter) ||
    v.includes('"') ||
    v.includes("\n") ||
    v.includes("\r")
  ) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

function dealToRow(d: DealDTO): Record<CsvKey, string> {
  const n = (v: number | null | undefined) =>
    v == null ? "" : String(v).replace(".", ","); // RU-десятичная запятая
  return {
    itemName: d.itemName,
    itemQuality: d.itemQuality ?? "",
    quantity: String(d.quantity),
    buyPlatform: d.buyPlatformName,
    buyPrice: n(d.buyPrice),
    buyCurrency: d.buyCurrency,
    buyFeePct: n(d.buyFeePct),
    buyDate: d.buyDate,
    status: STATUS_RU[d.status] ?? d.status,
    sellPlatform: d.sellPlatformName ?? "",
    sellPrice: n(d.sellPrice),
    sellCurrency: d.sellCurrency ?? "",
    sellFeePct: n(d.sellFeePct),
    sellDate: d.sellDate ?? "",
    note: d.note ?? "",
  };
}

/** Сериализовать сделки в CSV-строку (с BOM), разделитель `;`. */
export function serializeDeals(deals: DealDTO[]): string {
  const delimiter = ";";
  const header = CSV_COLUMNS.map((c) => csvCell(c.header, delimiter)).join(
    delimiter,
  );
  const rows = deals.map((d) => {
    const row = dealToRow(d);
    return CSV_COLUMNS.map((c) => csvCell(row[c.key], delimiter)).join(delimiter);
  });
  return BOM + [header, ...rows].join("\r\n") + "\r\n";
}

/** Пример-шаблон (заголовок + 2 демонстрационные строки). */
export function exampleCsv(): string {
  const delimiter = ";";
  const header = CSV_COLUMNS.map((c) => c.header).join(delimiter);
  const rows = [
    [
      "AK-47 | Redline",
      "Field-Tested",
      "1",
      "Market.CSGO",
      "1500",
      "RUB",
      "5",
      "2026-06-01",
      "продано",
      "Steam",
      "2100",
      "RUB",
      "13",
      "2026-06-10",
      "первая сделка",
    ],
    [
      "Glock-18 | Water Elemental",
      "Minimal Wear",
      "1",
      "Buff163",
      "12",
      "USD",
      "2.5",
      "2026-06-15",
      "в холде",
      "",
      "",
      "",
      "",
      "",
      "жду роста",
    ],
  ];
  const body = rows.map((r) => r.join(delimiter)).join("\r\n");
  return BOM + header + "\r\n" + body + "\r\n";
}

/** Разбор CSV-текста в матрицу строк. Разделитель определяется по заголовку. */
export function parseCsv(text: string): { delimiter: string; rows: string[][] } {
  let src = text;
  if (src.charCodeAt(0) === 0xfeff) src = src.slice(1); // срезать BOM
  // Определяем разделитель по первой строке: таб (вставка из таблиц), `;` или `,`.
  const firstLine = src.split(/\r?\n/, 1)[0] ?? "";
  const counts: Record<string, number> = {
    "\t": firstLine.split("\t").length,
    ";": firstLine.split(";").length,
    ",": firstLine.split(",").length,
  };
  const delimiter = (Object.keys(counts) as string[]).reduce((best, d) =>
    counts[d] > counts[best] ? d : best,
  ",");

  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      field = "";
      row = [];
    } else if (ch === "\r") {
      // игнорируем — перенос обрабатываем по \n
    } else {
      field += ch;
    }
  }
  // Последнее поле/строка, если файл не завершается переносом.
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  // Отбрасываем полностью пустые строки.
  return {
    delimiter,
    rows: rows.filter((r) => r.some((c) => c.trim() !== "")),
  };
}
