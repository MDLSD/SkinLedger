"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/native-select";
import {
  analyzeImportAction,
  commitImportAction,
  undoImportAction,
} from "@/lib/actions/import";
import {
  FIELD_LABELS,
  FIELD_ORDER,
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
  const headers = analyze.headers ?? [];

  // Пример значения по столбцу (для подписи в headerless-режиме).
  const sampleFor = (col: number) => {
    for (const r of rows) {
      const v = (r[col] ?? "").trim();
      if (v) return v;
    }
    return "";
  };

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
            Импорт отменён — удалено сделок: <b>{undoneCount}</b>.
          </p>
        ) : (
          <div className="space-y-2 rounded-lg border p-3 text-sm">
            <p>
              Импортировано:{" "}
              <span className="font-medium text-emerald-600">{commit.imported}</span>
              {commit.skipped ? (
                <>
                  {" · "}Пропущено:{" "}
                  <span className="font-medium text-amber-600">{commit.skipped}</span>
                </>
              ) : null}
            </p>
            {commit.warnings?.map((w, i) => (
              <p key={i} className="text-amber-600">
                ⚠ {w}
              </p>
            ))}
            {commit.rowErrors && commit.rowErrors.length > 0 && (
              <div>
                <p className="mb-1 text-muted-foreground">Строки с ошибками:</p>
                <ul className="max-h-48 space-y-0.5 overflow-y-auto text-xs text-muted-foreground">
                  {commit.rowErrors.map((e) => (
                    <li key={e.row}>
                      Строка {e.row}: {e.message}
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
                {undoing ? "Отмена…" : "Отменить импорт"}
              </Button>
            </form>
          )}
          <Button onClick={() => window.location.reload()}>Импортировать ещё</Button>
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
            Ваш файл: Excel (.xlsx), CSV — как есть
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
            …или вставьте строки из заметок / таблицы
          </label>
          <textarea
            id="text"
            name="text"
            rows={4}
            placeholder={"Название\tКачество\tЦена покупки\tДата покупки"}
            className="rounded-md border border-input bg-background px-3 py-2 font-mono text-xs"
          />
        </div>
        {analyze.sheetNames && analyze.sheetNames.length > 1 && (
          <div className="grid gap-1.5">
            <label htmlFor="sheet" className="text-sm text-muted-foreground">
              Лист книги
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
          {analyzing ? "Анализ…" : analyze.ok ? "Проанализировать заново" : "Проанализировать"}
        </Button>
        {analyze.error && <p className="text-sm text-red-600">{analyze.error}</p>}
      </form>

      {/* ---------- Шаг 2: превью и правка ---------- */}
      {analyze.ok && (
        <div className="space-y-4 rounded-lg border p-4">
          <div className="space-y-1 text-sm">
            <h3 className="font-medium">Проверьте перед импортом</h3>
            {analyze.notes?.map((n, i) => (
              <p key={i} className="text-xs text-muted-foreground">
                {n}
              </p>
            ))}
          </div>

          {/* Опции: валюта по умолчанию + формат даты */}
          <div className="flex flex-wrap gap-4">
            <label className="grid gap-1 text-sm">
              <span className="text-muted-foreground">Валюта по умолчанию</span>
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
              <span className="text-muted-foreground">Формат даты</span>
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
                <option value="dmy">День/Месяц (ДД.ММ)</option>
                <option value="mdy">Месяц/День (US, ММ/ДД)</option>
              </NativeSelect>
            </label>
          </div>

          {/* Сопоставление колонок */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Сопоставление колонок</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {FIELD_ORDER.map((field) => (
                <label key={field} className="flex items-center gap-2 text-sm">
                  <span className="w-40 shrink-0 text-muted-foreground">
                    {FIELD_LABELS[field]}
                    {REQUIRED.includes(field) && (
                      <span className="text-red-600"> *</span>
                    )}
                  </span>
                  <NativeSelect
                    value={mapping[field] ?? ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      setMapping((m) => {
                        const next = { ...m };
                        if (v === "") delete next[field];
                        else next[field] = Number(v);
                        return next;
                      });
                    }}
                    className="min-w-0 flex-1"
                  >
                    <option value="">— не импортировать —</option>
                    {headers.map((h, i) => (
                      <option key={i} value={i}>
                        {h}
                        {!analyze.headerFound && sampleFor(i)
                          ? `: ${sampleFor(i).slice(0, 24)}`
                          : ""}
                      </option>
                    ))}
                  </NativeSelect>
                </label>
              ))}
            </div>
          </div>

          {/* Превью первых строк */}
          <PreviewTable rows={rows} mapping={mapping} options={options} />

          {commit.error && <p className="text-sm text-red-600">{commit.error}</p>}
          {missingRequired.length > 0 && (
            <p className="text-sm text-amber-600">
              Укажите обязательные колонки:{" "}
              {missingRequired.map((k) => FIELD_LABELS[k]).join(", ")}
            </p>
          )}

          <form action={commitAction}>
            <input type="hidden" name="payload" value={payload} />
            <Button type="submit" disabled={committing || missingRequired.length > 0}>
              {committing ? "Импорт…" : `Импортировать (${rows.length})`}
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
  const preview = rows.slice(0, 6).map((r) => rowToFields(r, mapping, options));
  const money = (v: string, cur: string) => (v ? `${v} ${cur}` : "—");
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-muted-foreground">
            <th className="py-1 pr-3 font-normal">Название</th>
            <th className="py-1 pr-3 font-normal">Качество</th>
            <th className="py-1 pr-3 font-normal">Покупка</th>
            <th className="py-1 pr-3 font-normal">Дата пок.</th>
            <th className="py-1 pr-3 font-normal">Статус</th>
            <th className="py-1 pr-3 font-normal">Продажа</th>
            <th className="py-1 font-normal">Дата прод.</th>
          </tr>
        </thead>
        <tbody>
          {preview.map((f, i) => (
            <tr key={i} className="border-t">
              <td className="py-1 pr-3">{f.itemName || "—"}</td>
              <td className="py-1 pr-3">{f.itemQuality || "—"}</td>
              <td className="py-1 pr-3">{money(f.buyPrice, f.buyCurrency)}</td>
              <td className="py-1 pr-3">{f.buyDate || "сегодня"}</td>
              <td className="py-1 pr-3">
                {f.status === "sold"
                  ? "продано"
                  : f.status === "withdrawn_via_skin"
                    ? "вывод"
                    : "в холде"}
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
