"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { deleteAccountAction, type AuthFormState } from "@/lib/actions/auth";

export function DeleteAccount() {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(
    deleteAccountAction,
    {},
  );

  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button variant="destructive" />}>
        Удалить аккаунт
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Удалить аккаунт?</AlertDialogTitle>
          <AlertDialogDescription>
            Безвозвратно удалятся аккаунт, все сделки и ваши площадки.
            Действие нельзя отменить. Введите пароль для подтверждения.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <form action={action} className="space-y-3">
          <div className="grid gap-1.5">
            <Label htmlFor="del-pw">Пароль</Label>
            <Input
              id="del-pw"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              aria-invalid={state.error ? true : undefined}
            />
            {state.error && <p className="text-sm text-red-600">{state.error}</p>}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Отмена</AlertDialogCancel>
            <Button variant="destructive" type="submit" disabled={pending}>
              {pending ? "Удаление…" : "Удалить навсегда"}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
