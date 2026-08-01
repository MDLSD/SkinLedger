"use client";

import { useTranslations } from "next-intl";
import { useErrorMessage } from "@/i18n/error-message";
import { useActionState, useEffect } from "react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { NumberInput } from "@/components/number-input";
import { setMonthlyGoalAction, type SettingsState } from "@/lib/actions/settings";

export function GoalSettings({
  current,
  currency,
}: {
  current: number | null;
  currency: string;
}) {
  const t = useTranslations("settings");
  const router = useRouter();
  const errorMessage = useErrorMessage();
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
          {t("goalLabel", { currency })}
        </span>
        <NumberInput
          name="monthlyGoal"
          defaultValue={current ?? ""}
          placeholder={t("goalPlaceholder")}
          className="w-48"
        />
      </label>
      <Button type="submit" disabled={pending}>
        {pending ? t("saving") : t("save")}
      </Button>
      {state.success && <span className="text-sm text-emerald-400">{t("saved")}</span>}
      {state.error && <span className="text-sm text-red-400">{errorMessage(state.error, state.errorValues)}</span>}
    </form>
  );
}
