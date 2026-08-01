"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useErrorMessage } from "@/i18n/error-message";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/native-select";
import {
  analyzeImportAction,
  commitImportAction,
  undoImportAction,
} from "@/lib/actions/import";
import {
  rowToFields,
  type AnalyzeState,
  type CommitState,
  type FieldMapping,
  type ImportOptions,
  type UndoState,
} from "@/lib/deal-import";
import { CURRENCIES } from "@/lib/validation";
import type { CsvKey } from "@/lib/deal-csv";

const REQUIRED: CsvKey[] = ["itemName", "buyPrice"];

export function ImportDeals() {
  const t = useTranslations("import");
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const [analyze, analyzeAction, analyzing] = useActionState<AnalyzeState, FormData>(
    analyzeImportAction,
    {},
  );
  const [commit, commitAction, committing] = useActionState<CommitState, FormData>(
    commitImportAction,
    {},
  );
  const [undo, undoAction, undoing] = useActionState<UndoState, FormData>(
    undoImportAction,
    {},
  );

  // Локальные правки сопоставления/опций (инициализируются из анализа).
  const [mapping, setMapping] = useState<FieldMapping>({});
  const [options, setOptions] = useState<ImportOptions>({
    currency: "RUB",
    dateOrder: "dmy",
  });

  useEffect(() => {
    if (analyze.ok && analyze.mapping && analyze.options) {
      setMapping(analyze.mapping);
      setOptions(analyze.options);
    }
  }, [analyze]);

  const done = commit.imported != null;
  const undoneCount = undo.undone ?? null;

  useEffect(() => {
    if (done || undoneCount != null) router.refresh();
  }, [done, undoneCount, router]);

  const rows = analyze.rows ?? [];

  const payload = useMemo(
    () => JSON.stringify({ rows, mapping, options }),
    [rows, mapping, options],
  );

  const missingRequired = REQUIRED.filter((k) => mapping[k] == null);

  // ---------- Итог импорта ----------
  if (done) {
    return (
      <div className="space-y-4">
        {undoneCount != null ? (
          <p className="rounded-lg border p-3 text-sm">
            {t.rich("undone", {
              count: undoneCount,
              b: (chunks) => <b>{chunks}</b>,
            })}
          </p>
        ) : (
          <div className="space-y-2 rounded-lg border p-3 text-sm">
            <p>
              {t("imported")}{" "}
              <span className="font-medium text-emerald-400">{commit.imported}</span>
              {commit.skipped ? (
                <>
                  {" · "}
                  {t("skipped")}{" "}
                  <span className="font-medium text-amber-400">{commit.skipped}</span>
                </>
              ) : null}
            </p>
            {commit.warnings?.map((w, i) => (
              <p key={i} className="text-amber-400">
                ⚠ {errorMessage(w.key, w.values)}
              </p>
            ))}
            {commit.rowErrors && commit.rowErrors.length > 0 && (
              <div>
                <p className="mb-1 text-muted-foreground">{t("rowErrors")}</p>
                <ul className="max-h-48 space-y-0.5 overflow-y-auto text-xs text-muted-foreground">
                  {commit.rowErrors.map((e) => (
                    <li key={e.row}>
                      {t("row", { n: e.row })} {errorMessage(e.message.key, e.message.values)}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {undoneCount == null && (commit.createdIds?.length ?? 0) > 0 && (
            <form action={undoAction}>
              <input
                type="hidden"
                name="ids"
                value={JSON.stringify(commit.createdIds)}
              />
              <Button variant="outline" type="submit" disabled={undoing}>
                {undoing ? t("undoing") : t("undo")}
              </Button>
            </form>
          )}
          <Button onClick={() => window.location.reload()}>{t("importMore")}</Button>
        </div>
      </div>
    );
  }

  // ---------- Шаг 1: загрузка ----------
  return (
    <div className="space-y-5">
      <form action={analyzeAction} className="space-y-4">
        <div className="grid gap-1.5">
          <label htmlFor="file" className="text-sm text-muted-foreground">
            {t("fileLabel")}
          </label>
          <input
            id="file"
            name="file"
            type="file"
            accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="text-sm file:mr-3 file:rounded-md file:border file:border-input file:bg-background file:px-3 file:py-1.5 file:text-sm"
          />
        </div>
        <div className="grid gap-1.5">
          <label htmlFor="text" className="text-sm text-muted-foreground">
            {t("textLabel")}
          </label>
          <textarea
            id="text"
            name="text"
            rows={4}
            placeholder={t("textPlaceholder")}
            className="rounded-md border border-input bg-background px-3 py-2 font-mono text-xs"
          />
        </div>
        {analyze.sheetNames && analyze.sheetNames.length > 1 && (
          <div className="grid gap-1.5">
            <label htmlFor="sheet" className="text-sm text-muted-foreground">
              {t("sheet")}
            </label>
            <NativeSelect
              id="sheet"
              name="sheet"
              defaultValue={analyze.sheet}
              className="w-64"
            >
              {analyze.sheetNames.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </NativeSelect>
          </div>
        )}
        <Button type="submit" disabled={analyzing}>
          {analyzing ? t("analyzing") : analyze.ok ? t("analyzeAgain") : t("analyze")}
        </Button>
        {analyze.error && (
          <p className="text-sm text-red-400">
            {errorMessage(analyze.error, analyze.errorValues)}
          </p>
        )}
      </form>

      {/* ---------- Шаг 2: превью ---------- */}
      {analyze.ok && (
        <div className="space-y-4 rounded-lg border p-4">
          {/* Опции: валюта по умолчанию + формат даты */}
          <div className="flex flex-wrap gap-4">
            <label className="grid gap-1 text-sm">
              <span className="text-muted-foreground">{t("defaultCurrency")}</span>
              <NativeSelect
                value={options.currency}
                onChange={(e) =>
                  setOptions((o) => ({ ...o, currency: e.target.value }))
                }
                className="w-40"
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </NativeSelect>
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-muted-foreground">{t("dateFormat")}</span>
              <NativeSelect
                value={options.dateOrder}
                onChange={(e) =>
                  setOptions((o) => ({
                    ...o,
                    dateOrder: e.target.value as "dmy" | "mdy",
                  }))
                }
                className="w-48"
              >
                <option value="dmy">{t("dateDmy")}</option>
                <option value="mdy">{t("dateMdy")}</option>
              </NativeSelect>
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-muted-foreground">{t("feesInPrices")}</span>
              <NativeSelect
                value={options.applyPlatformFees ? "no" : "yes"}
                onChange={(e) =>
                  setOptions((o) => ({
                    ...o,
                    applyPlatformFees: e.target.value === "no",
                  }))
                }
                className="w-64"
              >
                <option value="yes">{t("feesIncluded")}</option>
                <option value="no">{t("feesExcluded")}</option>
              </NativeSelect>
            </label>
          </div>
          <p className="text-xs text-muted-foreground">
            {t("feesNote")}
          </p>

          {/* Превью первых строк */}
          <PreviewTable rows={rows} mapping={mapping} options={options} />

          {commit.error && (
            <p className="text-sm text-red-400">
              {errorMessage(commit.error, commit.errorValues)}
            </p>
          )}

          <form action={commitAction}>
            <input type="hidden" name="payload" value={payload} />
            <Button type="submit" disabled={committing || missingRequired.length > 0}>
              {committing ? t("importing") : t("importN", { n: rows.length })}
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}

function PreviewTable({
  rows,
  mapping,
  options,
}: {
  rows: string[][];
  mapping: FieldMapping;
  options: ImportOptions;
}) {
  const t = useTranslations("import");
  const preview = rows.slice(0, 6).map((r) => rowToFields(r, mapping, options));
  const money = (v: string, cur: string) => (v ? `${v} ${cur}` : "—");
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-muted-foreground">
            <th className="py-1 pr-3 font-normal">{t("colName")}</th>
            <th className="py-1 pr-3 font-normal">{t("colQuality")}</th>
            <th className="py-1 pr-3 font-normal">{t("colBuy")}</th>
            <th className="py-1 pr-3 font-normal">{t("colBuyDate")}</th>
            <th className="py-1 pr-3 font-normal">{t("colStatus")}</th>
            <th className="py-1 pr-3 font-normal">{t("colSell")}</th>
            <th className="py-1 font-normal">{t("colSellDate")}</th>
          </tr>
        </thead>
        <tbody>
          {preview.map((f, i) => (
            <tr key={i} className="border-t">
              <td className="py-1 pr-3">{f.itemName || "—"}</td>
              <td className="py-1 pr-3">{f.itemQuality || "—"}</td>
              <td className="py-1 pr-3">{money(f.buyPrice, f.buyCurrency)}</td>
              <td className="py-1 pr-3">{f.buyDate || t("today")}</td>
              <td className="py-1 pr-3">
                {f.status === "sold" ? t("statusSold") : t("statusHolding")}
              </td>
              <td className="py-1 pr-3">{money(f.sellPrice, f.sellCurrency)}</td>
              <td className="py-1">{f.sellDate || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
