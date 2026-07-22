// Предупреждение о состоянии курсов валют. Раньше о запасных курсах знала
// только страница настроек, хотя по ним считается весь дашборд и список.
import type { RatesSource } from "@/lib/rates";

export function RatesNotice({
  source,
  unresolvedFx = 0,
  excludedLabel,
}: {
  source: RatesSource;
  unresolvedFx?: number;
  /** Что именно произошло со сделками без курса на этой странице. */
  excludedLabel: string;
}) {
  const lines: string[] = [];
  if (source === "cache") {
    lines.push("Курсы валют не обновились — показаны последние загруженные.");
  } else if (source === "fallback") {
    lines.push("Парсер курсов недоступен — суммы посчитаны по запасным курсам.");
  }
  if (unresolvedFx > 0) {
    lines.push(`${unresolvedFx} ${excludedLabel}: нет курса валюты.`);
  }
  if (lines.length === 0) return null;

  return (
    <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
      {lines.map((l) => (
        <p key={l}>{l}</p>
      ))}
    </div>
  );
}
