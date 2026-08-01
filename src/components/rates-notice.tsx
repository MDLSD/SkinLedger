// Предупреждение о состоянии курсов валют. Раньше о запасных курсах знала
// только страница настроек, хотя по ним считается весь дашборд и список.
import { getFormatter, getTranslations } from "next-intl/server";
import type { RatesSource } from "@/lib/rates";
import { MAX_DEAL_ROWS } from "@/lib/db-batch";

export async function RatesNotice({
  source,
  unresolvedFx = 0,
  truncated = false,
  excludedLabel,
}: {
  source: RatesSource;
  unresolvedFx?: number;
  /** Выборка упёрлась в потолок — часть сделок не попала в расчёт. */
  truncated?: boolean;
  /**
   * Что именно произошло со сделками без курса на этой странице:
   * ключ перевода («скрыто» в списке, «не учтено» на дашборде).
   */
  excludedLabel: "hidden" | "excluded";
}) {
  const t = await getTranslations("rates");
  const format = await getFormatter();

  const lines: string[] = [];
  if (source === "cache") {
    lines.push(t("stale"));
  } else if (source === "fallback") {
    lines.push(t("fallback"));
  }
  if (unresolvedFx > 0) {
    lines.push(t(`noFx.${excludedLabel}`, { count: unresolvedFx }));
  }
  if (truncated) {
    lines.push(t("truncated", { max: format.number(MAX_DEAL_ROWS) }));
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
