"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changePasswordAction } from "@/lib/actions/auth";

export function PasswordSettings() {
  const [state, action, pending] = useActionState(changePasswordAction, {});

  return (
    <form action={action} className="grid gap-3 sm:max-w-sm">
      <div className="grid gap-1.5">
        <Label htmlFor="currentPassword">Текущий пароль</Label>
        <Input
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="newPassword">Новый пароль</Label>
        <Input
          id="newPassword"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Сохранение…" : "Сменить пароль"}
        </Button>
        {state.error && <span className="text-sm text-red-400">{state.error}</span>}
      </div>
    </form>
  );
}
