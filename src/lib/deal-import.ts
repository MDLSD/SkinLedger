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
  itemName: ["название", "наименование", "скин", "предмет", "товар", "item", "name", "skin"],
  itemQuality: ["качество", "износ", "состояние", "quality", "wear", "exterior"],
  quantity: ["количество", "кол-во", "колво", "шт", "штук", "qty", "count", "amount"],
  buyPlatform: [
    "площадка покупки", "площадка покупка", "куплено на", "где куплено",
    "маркет покупки", "buy platform", "buyplatform", "откуда", "площадка", "platform",
  ],
  buyPrice: [
    "цена покупки", "цена закупа", "закуп", "куплено за", "покупка", "buy price",
    "buyprice", "buy", "цена", "price", "cost",
  ],
  buyCurrency: ["валюта покупки", "валюта", "currency", "cur"],
  buyFeePct: ["комиссия покупки", "комиссия покупка", "buy fee", "buyfee", "комиссия"],
  buyDate: ["дата покупки", "дата покупка", "куплено дата", "buy date", "buydate", "дата", "date"],
  status: ["статус", "status", "состояние сделки"],
  sellPlatform: [
    "площадка продажи", "продано на", "где продано", "маркет продажи",
    "sell platform", "sellplatform",
  ],
  sellPrice: ["цена продажи", "цена прод", "продано за", "продажа", "продано", "sell price", "sellprice", "sell"],
  sellCurrency: ["валюта продажи", "sell currency", "sellcurrency"],
  sellFeePct: ["комиссия продажи", "комиссия продажа", "sell fee", "sellfee"],
  sellDate: ["дата продажи", "дата продажа", "продано дата", "sell date", "selldate"],
  note: ["комментарий", "коммент", "заметка", "примечание", "note", "comment"],
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
  const result = new Map<CsvKey, number>();
  const takenKeys = new Set<CsvKey>();

  // Для каждой колонки выбираем лучший ключ; затем разрешаем конфликты.
  const candidates: { col: number; key: CsvKey; score: number }[] = [];
  headerRow.forEach((h, col) => {
    const hn = norm(h);
    if (!hn) return;
    for (const key of Object.keys(ALIASES) as CsvKey[]) {
      for (const alias of ALIASES[key]) {
        let score = 0;
        if (hn === alias) score = alias.length + 100; // точное совпадение важнее
        else if (hn.includes(alias)) score = alias.length;
        if (score > 0) {
          candidates.push({ col, key, score });
        }
      }
    }
  });

  // Жадно: сначала самые уверенные совпадения; один ключ и одна колонка —
  // не более чем к одному сопоставлению.
  candidates.sort((a, b) => b.score - a.score);
  const takenCols = new Set<number>();
  for (const c of candidates) {
    if (takenKeys.has(c.key) || takenCols.has(c.col)) continue;
    result.set(c.key, c.col);
    takenKeys.add(c.key);
    takenCols.add(c.col);
  }
  return result;
}

/** Похоже ли, что строка — это заголовок (есть распознаваемые колонки). */
export function looksLikeHeader(row: string[]): boolean {
  const m = mapHeaders(row);
  return m.has("itemName") || m.has("buyPrice") || m.size >= 3;
}

/** Разбор даты в yyyy-mm-dd из распространённых форматов (ISO, DD.MM.YYYY, DD/MM/YYYY). */
export function parseDate(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  // ISO: 2026-06-01 (возможно с временем)
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  // DD.MM.YYYY / DD/MM/YYYY / DD-MM-YYYY (по умолчанию день первым).
  m = s.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})$/);
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
