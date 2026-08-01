"use client";

import { useTranslations } from "next-intl";
import { useErrorMessage } from "@/i18n/error-message";
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
  const t = useTranslations("settings");
  const errorMessage = useErrorMessage();
  const [state, action, pending] = useActionState<AuthFormState, FormData>(
    deleteAccountAction,
    {},
  );

  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button variant="destructive" />}>
        {t("deleteAccount")}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("confirmTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("confirmBody")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <form action={action} className="space-y-3">
          <div className="grid gap-1.5">
            <Label htmlFor="del-pw">{t("password")}</Label>
            <Input
              id="del-pw"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              aria-invalid={state.error ? true : undefined}
            />
            {state.error && <p className="text-sm text-red-400">{errorMessage(state.error, state.errorValues)}</p>}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">{t("cancel")}</AlertDialogCancel>
            <Button variant="destructive" type="submit" disabled={pending}>
              {pending ? t("deleting") : t("deleteForever")}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
