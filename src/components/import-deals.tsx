"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { importDealsAction, type ImportState } from "@/lib/actions/import";

export function ImportDeals() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<ImportState, FormData>(
    importDealsAction,
    {},
  );

  useEffect(() => {
    // После успешного импорта обновляем данные (список/дашборд).
    if (state.imported && state.imported > 0) router.refresh();
  }, [state.imported, router]);

  return (
    <form ref={formRef} action={action} className="space-y-4">
      <div className="grid gap-1.5">
        <label htmlFor="file" className="text-sm text-muted-foreground">
          CSV-файл со сделками
        </label>
        <input
          id="file"
          name="file"
          type="file"
          accept=".csv,text/csv"
          required
          className="text-sm file:mr-3 file:rounded-md file:border file:border-input file:bg-background file:px-3 file:py-1.5 file:text-sm"
        />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Импорт…" : "Импортировать"}
      </Button>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      {typeof state.imported === "number" && !state.error && (
        <div className="space-y-2 rounded-lg border p-3 text-sm">
          <p>
            Импортировано:{" "}
            <span className="font-medium text-emerald-600">{state.imported}</span>
            {state.skipped ? (
              <>
                {" · "}Пропущено:{" "}
                <span className="font-medium text-amber-600">{state.skipped}</span>
              </>
            ) : null}
          </p>
          {state.rowErrors && state.rowErrors.length > 0 && (
            <div>
              <p className="mb-1 text-muted-foreground">Строки с ошибками:</p>
              <ul className="max-h-48 space-y-0.5 overflow-y-auto text-xs text-muted-foreground">
                {state.rowErrors.map((e) => (
                  <li key={e.row}>
                    Строка {e.row}: {e.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </form>
  );
}
