"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setMonthlyGoalAction, type SettingsState } from "@/lib/actions/settings";

export function GoalSettings({
  current,
  currency,
}: {
  current: number | null;
  currency: string;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState<SettingsState, FormData>(
    setMonthlyGoalAction,
    {},
  );
  useEffect(() => {
    if (state.success) router.refresh();
  }, [state.success, router]);

  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <label className="grid gap-1.5 text-sm">
        <span className="text-muted-foreground">
          Цель чистой прибыли в месяц ({currency})
        </span>
        <Input
          name="monthlyGoal"
          type="number"
          min={0}
          step="any"
          inputMode="decimal"
          defaultValue={current ?? ""}
          placeholder="напр. 30000"
          className="w-48"
        />
      </label>
      <Button type="submit" disabled={pending}>
        {pending ? "Сохранение…" : "Сохранить"}
      </Button>
      {state.success && <span className="text-sm text-emerald-400">Сохранено</span>}
      {state.error && <span className="text-sm text-red-400">{state.error}</span>}
    </form>
  );
}
