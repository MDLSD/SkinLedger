"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { joinWaitlistAction, type WaitlistState } from "@/lib/actions/waitlist";

export function WaitlistForm({ feature }: { feature?: string }) {
  const [state, action, pending] = useActionState<WaitlistState, FormData>(
    joinWaitlistAction,
    {},
  );

  if (state.success) {
    return (
      <p className="text-sm text-emerald-600">
        Спасибо! Напишем, как только это появится.
      </p>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-2 sm:flex-row">
      {feature && <input type="hidden" name="feature" value={feature} />}
      <Input
        type="email"
        name="email"
        required
        placeholder="ваш@email"
        className="sm:max-w-xs"
        aria-invalid={state.error ? true : undefined}
      />
      <Button type="submit" disabled={pending}>
        {pending ? "Отправка…" : "Сообщить о запуске"}
      </Button>
      {state.error && (
        <span className="self-center text-sm text-red-600">{state.error}</span>
      )}
    </form>
  );
}
