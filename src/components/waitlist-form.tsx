"use client";

import { useTranslations } from "next-intl";
import { useErrorMessage } from "@/i18n/error-message";
import { useActionState } from "react";
import { joinWaitlistAction, type WaitlistState } from "@/lib/actions/waitlist";

// Стилизована под тёмный лендинг (не использует тему приложения).
export function WaitlistForm({ feature }: { feature?: string }) {
  const t = useTranslations("waitlist");
  const errorMessage = useErrorMessage();
  const [state, action, pending] = useActionState<WaitlistState, FormData>(
    joinWaitlistAction,
    {},
  );

  if (state.success) {
    return (
      <p className="text-sm text-emerald-400">
        {t("thanks")}
      </p>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-2 sm:flex-row">
      {feature && <input type="hidden" name="feature" value={feature} />}
      <input
        type="email"
        name="email"
        required
        placeholder={t("emailPlaceholder")}
        className="h-11 rounded-xl border border-white/15 bg-white/5 px-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-[#58e2b0]/60 focus:bg-white/10 sm:max-w-xs"
      />
      <button
        type="submit"
        disabled={pending}
        className="h-11 rounded-xl bg-[#58e2b0] px-5 text-sm font-semibold text-slate-950 transition hover:bg-[#7fecc4] disabled:opacity-50"
      >
        {pending ? t("sending") : t("notifyMe")}
      </button>
      {state.error && (
        <span className="self-center text-sm text-red-400">{errorMessage(state.error, state.errorValues)}</span>
      )}
    </form>
  );
}
