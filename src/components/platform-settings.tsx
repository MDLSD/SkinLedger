"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
          Встроенные площадки (для справки)
        </summary>
        <table className="mt-2 text-sm">
          <thead className="text-xs text-muted-foreground">
            <tr>
              <th className="pr-6 text-left font-normal">Площадка</th>
              <th className="pr-4 text-right font-normal">Покупка</th>
              <th className="text-right font-normal">Продажа</th>
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
  return (
    <>
      <div className="grid gap-1.5">
        <Label className="text-xs text-muted-foreground">Название</Label>
        <Input name="name" defaultValue={name} required maxLength={60} />
      </div>
      <div className="grid w-24 gap-1.5">
        <Label className="text-xs text-muted-foreground">Покупка, %</Label>
        <Input
          name="buyFeePct"
          type="number"
          min={0}
          max={100}
          step="any"
          inputMode="decimal"
          defaultValue={buyFee ?? 0}
        />
      </div>
      <div className="grid w-24 gap-1.5">
        <Label className="text-xs text-muted-foreground">Продажа, %</Label>
        <Input
          name="sellFeePct"
          type="number"
          min={0}
          max={100}
          step="any"
          inputMode="decimal"
          defaultValue={sellFee ?? 0}
        />
      </div>
    </>
  );
}

function PlatformRow({ platform }: { platform: PlatformDTO }) {
  const router = useRouter();
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
        {pending ? "…" : "Сохранить"}
      </Button>
      <DeletePlatform id={platform.id} name={platform.name} />
      {state.error && (
        <span className="w-full text-sm text-red-600">{state.error}</span>
      )}
    </form>
  );
}

function AddPlatformForm() {
  const router = useRouter();
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
        {pending ? "…" : "Добавить площадку"}
      </Button>
      {state.error && (
        <span className="w-full text-sm text-red-600">{state.error}</span>
      )}
    </form>
  );
}

function DeletePlatform({ id, name }: { id: string; name: string }) {
  const router = useRouter();
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
          Удалить
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить площадку «{name}»?</AlertDialogTitle>
            <AlertDialogDescription>
              Действие нельзя отменить. Если площадка используется в сделках,
              удаление будет отклонено.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <form action={action}>
              <input type="hidden" name="id" value={id} />
              <AlertDialogAction variant="destructive" type="submit" disabled={pending}>
                Удалить
              </AlertDialogAction>
            </form>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {state.error && (
        <span className="w-full text-sm text-red-600">{state.error}</span>
      )}
    </>
  );
}
