"use client";

import { useTranslations } from "next-intl";
import { useErrorMessage } from "@/i18n/error-message";

import { useActionState, useEffect } from "react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/number-input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  createPlatformAction,
  deletePlatformAction,
  updatePlatformAction,
  type PlatformState,
} from "@/lib/actions/platforms";

export type PlatformDTO = {
  id: string;
  name: string;
  buyFee: number;
  sellFee: number;
};

export function PlatformSettings({
  custom,
  seeded,
}: {
  custom: PlatformDTO[];
  seeded: { name: string; buyFee: number; sellFee: number }[];
}) {
  const t = useTranslations("platforms");
  return (
    <div className="space-y-5">
      {custom.length > 0 && (
        <div className="space-y-3">
          {custom.map((p) => (
            <PlatformRow key={p.id} platform={p} />
          ))}
        </div>
      )}

      <AddPlatformForm />

      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground">
          {t("builtIn")}
        </summary>
        <table className="mt-2 text-sm">
          <thead className="text-xs text-muted-foreground">
            <tr>
              <th className="pr-6 text-left font-normal">{t("platform")}</th>
              <th className="pr-4 text-right font-normal">{t("buy")}</th>
              <th className="text-right font-normal">{t("sell")}</th>
            </tr>
          </thead>
          <tbody>
            {seeded.map((s) => (
              <tr key={s.name}>
                <td className="py-0.5 pr-6">{s.name}</td>
                <td className="py-0.5 pr-4 text-right">{s.buyFee} %</td>
                <td className="py-0.5 text-right">{s.sellFee} %</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}

// Общий набор полей название/комиссии.
function Fields({
  name,
  buyFee,
  sellFee,
}: {
  name?: string;
  buyFee?: number;
  sellFee?: number;
}) {
  const t = useTranslations("platforms");
  return (
    <>
      <div className="grid gap-1.5">
        <Label className="text-xs text-muted-foreground">{t("name")}</Label>
        <Input name="name" defaultValue={name} required maxLength={60} />
      </div>
      <div className="grid w-24 gap-1.5">
        <Label className="text-xs text-muted-foreground">{t("buyPct")}</Label>
        <NumberInput
          name="buyFeePct"
          defaultValue={buyFee ?? 0}
        />
      </div>
      <div className="grid w-24 gap-1.5">
        <Label className="text-xs text-muted-foreground">{t("sellPct")}</Label>
        <NumberInput
          name="sellFeePct"
          defaultValue={sellFee ?? 0}
        />
      </div>
    </>
  );
}

function PlatformRow({ platform }: { platform: PlatformDTO }) {
  const t = useTranslations("platforms");
  const router = useRouter();
  const errorMessage = useErrorMessage();
  const [state, action, pending] = useActionState<PlatformState, FormData>(
    updatePlatformAction,
    {},
  );
  useEffect(() => {
    if (state.success) router.refresh();
  }, [state.success, router]);

  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="id" value={platform.id} />
      <Fields name={platform.name} buyFee={platform.buyFee} sellFee={platform.sellFee} />
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "…" : t("save")}
      </Button>
      <DeletePlatform id={platform.id} name={platform.name} />
      {state.error && (
        <span className="w-full text-sm text-red-400">{errorMessage(state.error, state.errorValues)}</span>
      )}
    </form>
  );
}

function AddPlatformForm() {
  const t = useTranslations("platforms");
  const router = useRouter();
  const errorMessage = useErrorMessage();
  const [state, action, pending] = useActionState<PlatformState, FormData>(
    createPlatformAction,
    {},
  );
  useEffect(() => {
    if (state.success) router.refresh();
  }, [state.success, router]);

  return (
    <form action={action} className="flex flex-wrap items-end gap-2 border-t pt-4">
      <Fields />
      <Button type="submit" disabled={pending}>
        {pending ? "…" : t("add")}
      </Button>
      {state.error && (
        <span className="w-full text-sm text-red-400">{errorMessage(state.error, state.errorValues)}</span>
      )}
    </form>
  );
}

function DeletePlatform({ id, name }: { id: string; name: string }) {
  const t = useTranslations("platforms");
  const router = useRouter();
  const errorMessage = useErrorMessage();
  const [state, action, pending] = useActionState<PlatformState, FormData>(
    deletePlatformAction,
    {},
  );
  useEffect(() => {
    if (state.success) router.refresh();
  }, [state.success, router]);

  return (
    <>
      <AlertDialog>
        <AlertDialogTrigger
          render={<Button variant="ghost" className="text-destructive" />}
        >
          {t("delete")}
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteTitle", { name })}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteBody")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <form action={action}>
              <input type="hidden" name="id" value={id} />
              <AlertDialogAction variant="destructive" type="submit" disabled={pending}>
                {t("delete")}
              </AlertDialogAction>
            </form>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {state.error && (
        <span className="w-full text-sm text-red-400">{errorMessage(state.error, state.errorValues)}</span>
      )}
    </>
  );
}
