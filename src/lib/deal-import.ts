// Гибкая нормализация «своих» таблиц при импорте: распознавание колонок по
// синонимам (без переименования), извлечение качества из названия вида
// «AWP | Corticera (Minimal Wear)», разбор дат в разных форматах.
import { CSV_COLUMNS, parseStatus, type CsvKey } from "@/lib/deal-csv";

// Допустимые коды валют (совпадают с CURRENCIES в validation).
const CURRENCY_CODES = ["RUB", "USD", "EUR", "CNY"];
const NUMERIC_FIELDS = new Set<CsvKey>([
  "buyPrice", "sellPrice", "buyFeePct", "sellFeePct", "quantity",
]);

// Каноничные износы (как в каталоге) + их синонимы/сокращения/RU.
const WEAR_ALIASES: Record<string, string> = {
  "factory new": "Factory New",
  fn: "Factory New",
  "прямо с завода": "Factory New",
  "minimal wear": "Minimal Wear",
  mw: "Minimal Wear",
  "немного поношенное": "Minimal Wear",
  "field-tested": "Field-Tested",
  "field tested": "Field-Tested",
  ft: "Field-Tested",
  "после полевых испытаний": "Field-Tested",
  "well-worn": "Well-Worn",
  "well worn": "Well-Worn",
  ww: "Well-Worn",
  поношенное: "Well-Worn",
  "battle-scarred": "Battle-Scarred",
  "battle scarred": "Battle-Scarred",
  bs: "Battle-Scarred",
  "закалённое в боях": "Battle-Scarred",
  "закаленное в боях": "Battle-Scarred",
};

export function canonicalWear(raw: string): string | null {
  return WEAR_ALIASES[raw.trim().toLowerCase()] ?? null;
}

/**
 * Разбор названия: отделяет качество, если оно записано в скобках В ЛЮБОМ
 * месте («AWP | Corticera (Minimal Wear)», «Karambit | Doppler (Factory New)
 * - Phase 2»). Скобки с износом вырезаются, остальной текст в названии остаётся.
 */
export function splitNameQuality(raw: string): {
  name: string;
  quality: string | null;
} {
  const s = raw.trim();
  const re = /\(([^()]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    const wear = canonicalWear(m[1]);
    if (wear) {
      const stripped = s.slice(0, m.index) + s.slice(m.index + m[0].length);
      const name = stripped
        .replace(/\s{2,}/g, " ")
        .replace(/\s*[-–—]\s*$/, "")
        .replace(/^\s*[-–—]\s*/, "")
        .trim();
      return { name, quality: wear };
    }
  }
  return { name: s, quality: null };
}

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/[.,%]/g, "").replace(/\s+/g, " ").trim();
}

// Синонимы заголовков. Порядок внутри массива не важен — при совпадении
// выигрывает самый длинный (специфичный) синоним, поэтому «цена продажи»
// уходит в sellPrice, а не в buyPrice по подстроке «цена».
const ALIASES: Record<CsvKey, string[]> = {
  itemName: [
    "название", "наименование", "назв", "имя", "скин", "предмет", "товар",
    "айтем", "вещь", "лот", "позиция", "модель", "оружие", "item", "item name",
    "name", "skin", "skin name", "title", "product", "asset", "gun", "weapon",
  ],
  itemQuality: [
    "качество", "износ", "состояние", "экстерьер", "внешний вид", "флоат",
    "quality", "wear", "exterior", "condition", "cond", "float", "grade",
  ],
  quantity: [
    "количество", "кол-во", "колво", "штук", "штуки", "штука", "шт",
    "куплено шт", "объем", "объём", "объем ордера", "quantity", "qty", "count",
    "amount", "units", "pcs", "pieces", "stock",
  ],
  buyPlatform: [
    "площадка покупки", "площадка покупка", "куплено на", "где куплено",
    "откуда куплено", "маркет покупки", "магазин покупки", "биржа покупки",
    "сайт покупки", "источник покупки", "источник", "откуда", "площадка",
    "маркет", "магазин", "биржа", "сайт", "площадка 1", "buy platform",
    "buyplatform", "buy market", "buy site", "bought from", "bought at",
    "purchased from", "source", "platform", "market", "marketplace", "store",
    "shop", "exchange", "venue",
  ],
  buyPrice: [
    "цена покупки", "покупная цена", "цена закупа", "закупочная цена", "закуп",
    "закупка", "куплено за", "купил за", "купил", "куплено", "покупка",
    "стоимость покупки", "себестоимость", "цена входа", "вход", "цена",
    "стоимость", "buy price", "buyprice", "purchase price", "purchase", "buy",
    "bought", "cost", "cost price", "price", "entry", "spent",
  ],
  buyCurrency: [
    "валюта покупки", "валюта покупка", "валюта", "buy currency",
    "currency", "ccy", "cur",
  ],
  buyFeePct: [
    "комиссия покупки", "комиссия покупка", "комиссия при покупке", "сбор покупки",
    "комиссия", "комис", "сбор", "buy fee", "buyfee", "buy commission",
    "purchase fee", "fee", "commission",
  ],
  buyDate: [
    "дата покупки", "дата покупка", "дата закупа", "куплено дата", "когда куплено",
    "число покупки", "дата", "buy date", "buydate", "purchase date", "date bought",
    "bought date", "date",
  ],
  status: ["статус", "состояние сделки", "стадия", "этап", "status", "state", "stage"],
  sellPlatform: [
    "площадка продажи", "продано на", "где продано", "куда продано",
    "маркет продажи", "магазин продажи", "биржа продажи", "сайт продажи",
    "площадка 2", "sell platform", "sellplatform",
    "sell market", "sell site", "sold on", "sold to", "sold at", "destination",
  ],
  sellPrice: [
    "цена продажи", "продажная цена", "цена прод", "продано за", "продал за",
    "продал", "продано", "продажа", "стоимость продажи", "цена выхода", "выход",
    "выручка", "получено", "реализация", "sell price", "sellprice", "sale price",
    "sale", "sell", "sold", "revenue", "exit", "received", "proceeds",
  ],
  sellCurrency: [
    "валюта продажи", "валюта продажа", "sell currency", "sellcurrency",
  ],
  sellFeePct: [
    "комиссия продажи", "комиссия продажа", "комиссия при продаже", "сбор продажи",
    "sell fee", "sellfee", "sell commission", "sale fee",
  ],
  sellDate: [
    "дата продажи", "дата продажа", "продано дата", "когда продано",
    "дата выхода", "дата реализации", "sell date", "selldate", "sale date",
    "date sold", "sold date",
  ],
  note: [
    "комментарий", "коммент", "заметка", "заметки", "примечание", "описание",
    "пометка", "инфо", "note", "notes", "comment", "comments", "remark",
    "description", "info", "memo",
  ],
};

// Точные RU-заголовки шаблона тоже должны совпадать (на случай экспорта→импорта).
for (const c of CSV_COLUMNS) {
  const n = norm(c.header);
  if (!ALIASES[c.key].includes(n)) ALIASES[c.key].push(n);
}

/**
 * Сопоставляет колонки файла с ключами по заголовкам. Возвращает индекс
 * колонки для каждого распознанного ключа. Совпадение — по равенству или
 * вхождению синонима; выигрывает самый длинный синоним (специфичность).
 */
export function mapHeaders(headerRow: string[]): Map<CsvKey, number> {
  // Для каждой колонки определяем ЕДИНСТВЕННЫЙ лучший ключ (по специфичности
  // синонима). Колонку нельзя «понизить» до менее подходящего ключа — иначе,
  // например, «куплено на» (площадка) при занятой площадке утекло бы в цену.
  const best: { col: number; key: CsvKey; score: number }[] = [];
  headerRow.forEach((h, col) => {
    const hn = norm(h);
    if (!hn) return;
    let bestKey: CsvKey | null = null;
    let bestScore = 0;
    for (const key of Object.keys(ALIASES) as CsvKey[]) {
      for (const alias of ALIASES[key]) {
        let score = 0;
        if (hn === alias) score = alias.length + 100; // точное совпадение важнее
        else if (hn.includes(alias)) score = alias.length;
        if (score > bestScore) {
          bestScore = score;
          bestKey = key;
        }
      }
    }
    if (bestKey) best.push({ col, key: bestKey, score: bestScore });
  });

  // Сначала самые уверенные; если лучший ключ уже занят — колонку пропускаем
  // (а не переносим в другой ключ).
  best.sort((a, b) => b.score - a.score);
  const result = new Map<CsvKey, number>();
  for (const c of best) {
    if (result.has(c.key)) continue;
    result.set(c.key, c.col);
  }
  return result;
}

/** Похоже ли, что строка — это заголовок (есть распознаваемые колонки). */
export function looksLikeHeader(row: string[]): boolean {
  const m = mapHeaders(row);
  return m.has("itemName") || m.has("buyPrice") || m.size >= 3;
}

/**
 * Нормализует число из «человеческой» записи в строку с точкой-десятичной.
 * Понимает оба разделителя тысяч/дробей: «2,835.00» (US) и «1.600,50» (EU),
 * «2 500», валютные знаки. Возвращает "" если чисел нет.
 */
export function normalizeNumber(raw: string): string {
  let s = raw.replace(/[^\d.,-]/g, ""); // оставляем цифры, разделители, минус
  if (!s) return "";
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  if (hasComma && hasDot) {
    // Десятичный — тот разделитель, что стоит правее; другой — тысячи.
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) {
      s = s.replace(/\./g, "").replace(",", "."); // EU: 1.600,50 → 1600.50
    } else {
      s = s.replace(/,/g, ""); // US: 2,835.00 → 2835.00
    }
  } else if (hasComma) {
    // Только запятая: группы по 3 цифры → тысячи, иначе десятичная.
    if (/^-?\d{1,3}(,\d{3})+$/.test(s)) s = s.replace(/,/g, "");
    else s = s.replace(",", ".");
  } else if (hasDot) {
    // Только точка: «2.500» (группы по 3) → тысячи, иначе десятичная.
    if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  }
  return s;
}

// Перевод серийного номера даты Excel (дней от 1899-12-30) в yyyy-mm-dd.
function excelSerialToDate(serial: number): string | null {
  if (serial <= 20000 || serial >= 80000) return null; // ~2024…2119, вне — не дата
  const d = new Date(Math.round((serial - 25569) * 86_400_000));
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

export type DateOrder = "dmy" | "mdy";

/**
 * Разбор даты в yyyy-mm-dd: ISO, серийник Excel, DD.MM.YYYY / MM/DD/YYYY.
 * Для неоднозначных (оба числа ≤ 12) порядок задаётся `order` (по умолчанию
 * день-первым); если «месяц» > 12 — авто-своп независимо от order.
 */
export function parseDate(raw: string, order: DateOrder = "dmy"): string | null {
  const s = raw.trim();
  if (!s) return null;
  // ISO: 2026-06-01 (возможно с временем)
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  // Серийный номер даты Excel (голое число, напр. 45704 или 46190.63).
  if (/^\d{4,6}(\.\d+)?$/.test(s)) {
    const iso = excelSerialToDate(parseFloat(s));
    if (iso) return iso;
  }
  // DD.MM.YYYY / MM/DD/YYYY / DD-MM-YYYY (с опциональным временем после).
  m = s.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})(?:[ T].*)?$/);
  if (m) {
    const p1 = parseInt(m[1], 10);
    const p2 = parseInt(m[2], 10);
    let day = order === "mdy" ? p2 : p1;
    let mo = order === "mdy" ? p1 : p2;
    // «Месяц» > 12 физически невозможен — значит порядок обратный, меняем.
    if (mo > 12 && day <= 12) [day, mo] = [mo, day];
    if (mo < 1 || mo > 12 || day < 1 || day > 31) return null;
    let y = m[3];
    if (y.length === 2) y = "20" + y;
    return `${y}-${String(mo).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  return null;
}

/**
 * Определяет порядок дат в столбце: если хоть в одной дате второе число > 12
 * (а первое ≤ 12) — это MM/DD (US). По умолчанию день-первым.
 */
export function detectDateOrder(values: string[]): DateOrder {
  let mdy = false;
  let dmy = false;
  for (const v of values) {
    const m = v.trim().match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-]\d{2,4}/);
    if (!m) continue;
    const a = +m[1];
    const b = +m[2];
    if (a > 12 && b <= 12) dmy = true; // первое > 12 → день первым
    if (b > 12 && a <= 12) mdy = true; // второе > 12 → месяц первым
  }
  return mdy && !dmy ? "mdy" : "dmy";
}

// ---------- Определение валюты по символу/коду в ячейке цены ----------

export function currencyOfCell(raw: string): string | null {
  const s = raw.toLowerCase();
  if (s.includes("$") || /\busd\b/.test(s) || s.includes("долл")) return "USD";
  if (s.includes("€") || /\beur\b/.test(s) || s.includes("евро")) return "EUR";
  if (s.includes("¥") || /\b(cny|rmb|yuan)\b/.test(s) || s.includes("юан")) return "CNY";
  if (s.includes("₽") || /\brub\b/.test(s) || s.includes("руб") || /\bр\b/.test(s))
    return "RUB";
  return null;
}

/** Наиболее частая валюта среди ячеек (или null, если символов нет). */
export function detectCurrency(cells: string[]): string | null {
  const counts: Record<string, number> = {};
  for (const c of cells) {
    const cur = currencyOfCell(c);
    if (cur) counts[cur] = (counts[cur] ?? 0) + 1;
  }
  const keys = Object.keys(counts);
  return keys.length ? keys.sort((a, b) => counts[b] - counts[a])[0] : null;
}

// ---------- Классификация значений столбца ----------

/** Булевоподобное значение: "true"/"false"/null. */
export function isBooleanish(v: string): "true" | "false" | null {
  const s = v.trim().toLowerCase();
  if (!s) return null;
  if (["yes", "y", "да", "д", "true", "✓", "✔", "sold", "продано"].includes(s))
    return "true";
  if (["no", "n", "нет", "н", "false", "✗", "holding", "в холде", "холд"].includes(s))
    return "false";
  return null;
}

export function looksNumeric(v: string): boolean {
  const n = normalizeNumber(v);
  return n !== "" && Number.isFinite(Number(n));
}

function columnValues(rows: string[][], col: number, limit = 20): string[] {
  const out: string[] = [];
  for (const r of rows) {
    const v = (r[col] ?? "").trim();
    if (v) out.push(v);
    if (out.length >= limit) break;
  }
  return out;
}

const frac = (vals: string[], f: (v: string) => boolean) =>
  vals.length ? vals.filter(f).length / vals.length : 0;

// ---------- Сопоставление колонок с учётом значений ----------

export type FieldMapping = Partial<Record<CsvKey, number>>;

/**
 * Сопоставляет колонки с полями по заголовкам И значениям: числовое поле с
 * булевыми значениями (yes/no) уводится в статус; числовое поле с текстом —
 * не мапится (не даём, например, «Sold?» перехватить «цену продажи»).
 */
export function mapColumns(headers: string[], rows: string[][]): FieldMapping {
  const best: { col: number; key: CsvKey; score: number }[] = [];
  headers.forEach((h, col) => {
    const hn = norm(h);
    if (!hn) return;
    let bestKey: CsvKey | null = null;
    let bestScore = 0;
    for (const key of Object.keys(ALIASES) as CsvKey[]) {
      for (const alias of ALIASES[key]) {
        let score = 0;
        if (hn === alias) score = alias.length + 100;
        else if (hn.includes(alias)) score = alias.length;
        if (score > bestScore) {
          bestScore = score;
          bestKey = key;
        }
      }
    }
    if (!bestKey) return;
    // Проверка по значениям для числовых полей.
    if (NUMERIC_FIELDS.has(bestKey)) {
      const vals = columnValues(rows, col);
      if (vals.length >= 2) {
        if (frac(vals, (v) => isBooleanish(v) !== null) >= 0.6) {
          bestKey = "status"; // столбец yes/no → это статус, а не цена
          bestScore = 60;
        } else if (frac(vals, looksNumeric) < 0.5) {
          return; // в числовой колонке текст → не мапим
        }
      }
    }
    best.push({ col, key: bestKey, score: bestScore });
  });

  best.sort((a, b) => b.score - a.score);
  const result: FieldMapping = {};
  const takenKey = new Set<CsvKey>();
  for (const c of best) {
    if (takenKey.has(c.key)) continue;
    result[c.key] = c.col;
    takenKey.add(c.key);
  }
  return result;
}

/** Мусорная строка: одна непустая ячейка или строка-итог. */
export function isJunkRow(row: string[]): boolean {
  const nonEmpty = row.filter((c) => c.trim());
  if (nonEmpty.length <= 1) return true;
  const joined = row.join(" ").toLowerCase();
  if (nonEmpty.length <= 3 && /(итого|итог|всего|total|subtotal|summary)/.test(joined))
    return true;
  return false;
}

/**
 * Ищет строку заголовков в первых ~15 строках (над реальной шапкой часто
 * бывают баннеры/названия отчёта). Возвращает индекс или -1.
 */
export function detectHeaderRow(rows: string[][]): number {
  const limit = Math.min(15, rows.length);
  let bestI = -1;
  let bestScore = 0;
  for (let i = 0; i < limit; i++) {
    if (rows[i].filter((c) => c.trim()).length < 2) continue;
    const m = mapColumns(rows[i], rows.slice(i + 1, i + 8));
    let score = Object.keys(m).length;
    if (m.itemName != null) score += 3;
    if (m.buyPrice != null) score += 3;
    if (score > bestScore) {
      bestScore = score;
      bestI = i;
    }
  }
  if (bestI >= 0) {
    const m = mapColumns(rows[bestI], rows.slice(bestI + 1, bestI + 8));
    if (m.itemName != null && m.buyPrice != null) return bestI;
  }
  return -1;
}

/** Догадка сопоставления по значениям (для файлов без строки заголовков). */
export function guessMappingByValues(rows: string[][]): FieldMapping {
  const ncols = rows.reduce((n, r) => Math.max(n, r.length), 0);
  const result: FieldMapping = {};
  const taken = new Set<number>();
  // Столбец износов → качество.
  for (let c = 0; c < ncols; c++) {
    const v = columnValues(rows, c);
    if (v.length && frac(v, (x) => canonicalWear(x) != null) >= 0.6) {
      result.itemQuality = c;
      taken.add(c);
      break;
    }
  }
  // Название: текстовый столбец (не числа/не даты), приоритет тем, где есть «|».
  let nameCol = -1;
  let nameScore = -1;
  for (let c = 0; c < ncols; c++) {
    if (taken.has(c)) continue;
    const v = columnValues(rows, c);
    if (!v.length || frac(v, looksNumeric) > 0.5) continue;
    if (frac(v, (x) => parseDate(x) != null) > 0.5) continue;
    const pipes = v.filter((x) => x.includes("|")).length;
    const avgLen = v.reduce((s, x) => s + x.length, 0) / v.length;
    const sc = pipes * 100 + avgLen;
    if (sc > nameScore) {
      nameScore = sc;
      nameCol = c;
    }
  }
  if (nameCol >= 0) {
    result.itemName = nameCol;
    taken.add(nameCol);
  }
  // Дата покупки: столбец дат.
  for (let c = 0; c < ncols; c++) {
    if (taken.has(c)) continue;
    const v = columnValues(rows, c);
    if (v.length && frac(v, (x) => parseDate(x) != null) >= 0.6) {
      result.buyDate = c;
      taken.add(c);
      break;
    }
  }
  // Цена покупки: первый числовой столбец.
  for (let c = 0; c < ncols; c++) {
    if (taken.has(c)) continue;
    const v = columnValues(rows, c);
    if (v.length && frac(v, looksNumeric) >= 0.6) {
      result.buyPrice = c;
      taken.add(c);
      break;
    }
  }
  return result;
}

/** Индекс столбца-флага StatTrak/Souvenir (отдельная колонка «категория»). */
export function detectFlagColumn(headers: string[]): number | null {
  for (let i = 0; i < headers.length; i++) {
    const h = norm(headers[i]);
    if (/stat ?trak|статтрак|souvenir|сувенир|st\/sv|категория|category/.test(h))
      return i;
  }
  return null;
}

function flagPrefix(raw: string): string {
  const s = raw.toLowerCase();
  if (/stat|статтрак/.test(s)) return "StatTrak™ ";
  if (/souv|сувенир/.test(s)) return "Souvenir ";
  return "";
}

// ---------- Единая нормализация строки в поля сделки ----------

export type ImportOptions = {
  currency: string; // валюта по умолчанию (когда нет символа и столбца валюты)
  dateOrder: DateOrder;
  flagCol?: number | null; // столбец StatTrak/Souvenir
  // Цены БЕЗ комиссии площадки → подставить комиссию распознанной площадки.
  // false = цены уже итоговые (комиссия учтена), ничего не применяем.
  applyPlatformFees?: boolean;
};

export type RowFields = {
  itemName: string;
  itemQuality: string;
  quantity: string;
  buyPlatform: string;
  buyPrice: string;
  buyCurrency: string;
  buyFeePct: string;
  buyDate: string;
  status: string;
  sellPlatform: string;
  sellPrice: string;
  sellCurrency: string;
  sellFeePct: string;
  sellDate: string;
  note: string;
  // Флаги для предупреждений (не идут в БД напрямую).
  buyDateMissing: boolean;
  currencyDefaulted: boolean;
};

const validCur = (c: string, fallback: string) =>
  CURRENCY_CODES.includes(c) ? c : fallback;

/** Превращает сырую строку в нормализованные поля (используется превью и импортом). */
export function rowToFields(
  row: string[],
  map: FieldMapping,
  opts: ImportOptions,
): RowFields {
  const get = (k: CsvKey) => {
    const i = map[k];
    return i == null ? "" : (row[i] ?? "").trim();
  };

  const split = splitNameQuality(get("itemName"));
  let name = split.name;
  const qCol = get("itemQuality");
  const quality = qCol ? (canonicalWear(qCol) ?? qCol) : (split.quality ?? "");

  // Отдельный столбец StatTrak/Souvenir → префикс к названию.
  if (opts.flagCol != null && name) {
    const pref = flagPrefix((row[opts.flagCol] ?? "").trim());
    if (pref && !name.toLowerCase().includes(pref.trim().toLowerCase().slice(0, 4)))
      name = pref + name;
  }

  const buyRaw = get("buyPrice");
  const sellRaw = get("sellPrice");
  const buyCurCol = get("buyCurrency").toUpperCase();
  const buyDetected = buyCurCol || currencyOfCell(buyRaw);
  const buyCurrency = validCur(buyDetected || opts.currency, opts.currency);
  const sellCurCol = get("sellCurrency").toUpperCase();
  const sellCurrency = validCur(
    sellCurCol || currencyOfCell(sellRaw) || buyCurrency,
    buyCurrency,
  );

  const rawBuyDate = parseDate(get("buyDate"), opts.dateOrder) ?? "";
  const sellDate = parseDate(get("sellDate"), opts.dateOrder) ?? "";

  // Статус: явная колонка (текст/да-нет) либо вывод.
  let status = "";
  const stCol = get("status");
  if (stCol) {
    const b = isBooleanish(stCol);
    status = parseStatus(stCol) ?? (b === "true" ? "sold" : b === "false" ? "holding" : "");
  }
  if (!status) {
    // Если в таблице есть колонка даты продажи — «продано» только когда эта
    // дата заполнена. Цена продажи без даты — это целевая цена/листинг, а не
    // совершённая сделка, поэтому такой предмет остаётся «в холде».
    // Без колонки даты продажи ориентируемся на наличие цены продажи.
    status =
      map.sellDate != null
        ? sellDate !== ""
          ? "sold"
          : "holding"
        : normalizeNumber(sellRaw) !== ""
          ? "sold"
          : "holding";
  }

  // Нет даты покупки, но есть дата продажи → берём её (покупка не может быть
  // позже продажи). Иначе импорт подставит сегодня.
  const buyDate =
    rawBuyDate || (status !== "holding" && sellDate ? sellDate : "");

  return {
    itemName: name,
    itemQuality: quality,
    quantity: normalizeNumber(get("quantity")),
    buyPlatform: get("buyPlatform"),
    buyPrice: normalizeNumber(buyRaw),
    buyCurrency,
    buyFeePct: normalizeNumber(get("buyFeePct")),
    buyDate,
    status,
    sellPlatform: get("sellPlatform"),
    sellPrice: normalizeNumber(sellRaw),
    sellCurrency,
    sellFeePct: normalizeNumber(get("sellFeePct")),
    sellDate,
    note: get("note"),
    buyDateMissing: rawBuyDate === "",
    currencyDefaulted: !buyDetected,
  };
}

// Человекочитаемые названия полей (для UI сопоставления).
export const FIELD_LABELS: Record<CsvKey, string> = {
  itemName: "Название",
  itemQuality: "Качество",
  quantity: "Количество",
  buyPlatform: "Площадка покупки",
  buyPrice: "Цена покупки",
  buyCurrency: "Валюта покупки",
  buyFeePct: "Комиссия покупки, %",
  buyDate: "Дата покупки",
  status: "Статус",
  sellPlatform: "Площадка продажи",
  sellPrice: "Цена продажи",
  sellCurrency: "Валюта продажи",
  sellFeePct: "Комиссия продажи, %",
  sellDate: "Дата продажи",
  note: "Комментарий",
};

export const FIELD_ORDER: CsvKey[] = [
  "itemName", "itemQuality", "quantity", "buyPlatform", "buyPrice",
  "buyCurrency", "buyFeePct", "buyDate", "status", "sellPlatform",
  "sellPrice", "sellCurrency", "sellFeePct", "sellDate", "note",
];

// ---------- Состояния серверных экшенов (общие для клиента) ----------

export type AnalyzeState = {
  ok?: boolean;
  error?: string;
  headers?: string[];
  rows?: string[][]; // все строки данных (для коммита)
  mapping?: FieldMapping;
  options?: ImportOptions;
  headerFound?: boolean; // false → заголовки не найдены, маппинг по значениям
  sheetNames?: string[];
  sheet?: string;
  currencyDetected?: string | null;
  notes?: string[]; // информационные пометки анализа
};

export type CommitState = {
  error?: string;
  imported?: number;
  skipped?: number;
  rowErrors?: { row: number; message: string }[];
  warnings?: string[];
  createdIds?: string[];
};

export type UndoState = { error?: string; undone?: number };
