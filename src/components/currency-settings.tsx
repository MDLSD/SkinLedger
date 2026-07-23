"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/native-select";
import { setBaseCurrencyAction } from "@/lib/actions/settings";
import { BASE_CURRENCIES } from "@/lib/validation";
import { CURRENCY_SYMBOL } from "@/lib/currency";

export function CurrencySettings({ current }: { current: string }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(setBaseCurrencyAction, {});

  useEffect(() => {
    if (state.success) router.refresh();
  }, [state.success, router]);

  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <label className="grid gap-1.5 text-sm">
        <span className="text-muted-foreground">Основная валюта отчётов</span>
        <NativeSelect name="baseCurrency" defaultValue={current} className="w-48">
          {BASE_CURRENCIES.map((c) => (
            <option key={c} value={c}>
              {c} {CURRENCY_SYMBOL[c] ?? ""}
            </option>
          ))}
        </NativeSelect>
      </label>
      <Button type="submit" disabled={pending}>
        {pending ? "Сохранение…" : "Сохранить"}
      </Button>
      {state.success && (
        <span className="text-sm text-emerald-400">Сохранено</span>
      )}
      {state.error && <span className="text-sm text-red-400">{state.error}</span>}
    </form>
  );
}
