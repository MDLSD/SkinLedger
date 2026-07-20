// Гибкая нормализация «своих» таблиц при импорте: распознавание колонок по
// синонимам (без переименования), извлечение качества из названия вида
// «AWP | Corticera (Minimal Wear)», разбор дат в разных форматах.
import { CSV_COLUMNS, type CsvKey } from "@/lib/deal-csv";

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
 * Разбор названия: отделяет качество, если оно записано в скобках в конце
 * («AWP | Corticera (Minimal Wear)» → name «AWP | Corticera», quality «Minimal Wear»).
 * Если в скобках не износ — оставляем название как есть.
 */
export function splitNameQuality(raw: string): {
  name: string;
  quality: string | null;
} {
  const s = raw.trim();
  const m = s.match(/^(.*)\(([^()]+)\)\s*$/);
  if (m) {
    const wear = canonicalWear(m[2]);
    if (wear) return { name: m[1].trim(), quality: wear };
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
    "quality", "wear", "exterior", "condition", "float", "grade",
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
    "buyplatform", "buy market", "buy site", "source", "platform", "market",
    "marketplace", "store", "shop", "exchange", "venue",
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
    "площадка вывода", "площадка 2", "sell platform", "sellplatform",
    "sell market", "sell site", "sold on", "destination",
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

/** Разбор даты в yyyy-mm-dd: ISO, серийник Excel, DD.MM.YYYY / DD/MM/YYYY. */
export function parseDate(raw: string): string | null {
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
  // DD.MM.YYYY / DD/MM/YYYY / DD-MM-YYYY (по умолчанию день первым, с опц. временем).
  m = s.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})(?:[ T].*)?$/);
  if (m) {
    let day = parseInt(m[1], 10);
    let mo = parseInt(m[2], 10);
    // Если «месяц» > 12, а «день» ≤ 12 — это американский формат M/D, меняем.
    if (mo > 12 && day <= 12) [day, mo] = [mo, day];
    if (mo < 1 || mo > 12 || day < 1 || day > 31) return null;
    let y = m[3];
    if (y.length === 2) y = "20" + y;
    return `${y}-${String(mo).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  return null;
}
