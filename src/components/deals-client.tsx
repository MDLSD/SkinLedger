"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DealForm } from "@/components/deal-form";
import { deleteDealAction } from "@/lib/actions/deals";
import {
  formatMoney,
  formatPct,
  holdingDays,
  marginPct,
  profit,
} from "@/lib/deal-math";
import type { DealDTO, PlatformDTO } from "@/lib/types";

function formatDate(d: string | null) {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${day}.${m}.${y}`;
}

function StatusBadge({ status }: { status: string }) {
  if (status === "sold") return <Badge>Продано</Badge>;
  if (status === "withdrawn_via_skin")
    return <Badge variant="outline">Вывод</Badge>;
  return <Badge variant="secondary">В холде</Badge>;
}

function DeleteButton({ deal }: { deal: DealDTO }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(deleteDealAction, {});

  useEffect(() => {
    if (state.success) router.refresh();
  }, [state.success, router]);

  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button variant="ghost" size="sm" className="text-destructive" />
        }
      >
        Удалить
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Удалить сделку?</AlertDialogTitle>
          <AlertDialogDescription>
            «{deal.itemName}» будет удалена безвозвратно.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Отмена</AlertDialogCancel>
          <form action={formAction}>
            <input type="hidden" name="dealId" value={deal.id} />
            <AlertDialogAction variant="destructive" type="submit" disabled={pending}>
              Удалить
            </AlertDialogAction>
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

type Props = {
  deals: DealDTO[];
  platforms: PlatformDTO[];
  itemNames: string[];
  baseCurrency: string;
};

export function DealsClient({ deals, platforms, itemNames, baseCurrency }: Props) {
  const [dialog, setDialog] = useState<{
    open: boolean;
    deal: DealDTO | null;
    withSell: boolean;
  }>({ open: false, deal: null, withSell: false });

  const openCreate = () => setDialog({ open: true, deal: null, withSell: false });
  const openEdit = (deal: DealDTO) =>
    setDialog({ open: true, deal, withSell: deal.status !== "holding" });
  const openSell = (deal: DealDTO) =>
    setDialog({ open: true, deal, withSell: true });
  const close = () => setDialog((d) => ({ ...d, open: false }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Сделки</h1>
        <Button onClick={openCreate}>Добавить сделку</Button>
      </div>

      {deals.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          Пока нет сделок. Добавьте первую — и увидите прибыль ещё до сохранения.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Скин</TableHead>
                <TableHead>Покупка</TableHead>
                <TableHead>Продажа</TableHead>
                <TableHead className="text-right">Прибыль</TableHead>
                <TableHead className="text-right">Маржа</TableHead>
                <TableHead className="text-right">Дней</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {deals.map((deal) => {
                const p = profit(deal);
                const m = marginPct(deal);
                const isWithdrawal = deal.status === "withdrawn_via_skin";
                return (
                  <TableRow key={deal.id}>
                    <TableCell>
                      <div className="font-medium">
                        {deal.itemName}
                        {deal.quantity > 1 && (
                          <span className="text-muted-foreground"> ×{deal.quantity}</span>
                        )}
                      </div>
                      {deal.itemQuality && (
                        <div className="text-xs text-muted-foreground">
                          {deal.itemQuality}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div>{formatMoney(deal.buyPrice, deal.buyCurrency)}</div>
                      <div className="text-xs text-muted-foreground">
                        {deal.buyPlatformName} · {formatDate(deal.buyDate)}
                      </div>
                    </TableCell>
                    <TableCell>
                      {deal.sellPrice != null ? (
                        <>
                          <div>
                            {formatMoney(deal.sellPrice, deal.sellCurrency ?? "RUB")}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {deal.sellPlatformName} · {formatDate(deal.sellDate)}
                          </div>
                        </>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {p == null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <span
                          className={
                            isWithdrawal
                              ? "text-amber-600"
                              : p >= 0
                                ? "text-emerald-600"
                                : "text-red-600"
                          }
                        >
                          {formatMoney(p, baseCurrency, true)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {m == null || isWithdrawal ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        formatPct(m)
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {holdingDays(deal.buyDate, deal.sellDate)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={deal.status} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right">
                      {deal.status === "holding" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openSell(deal)}
                        >
                          Продано
                        </Button>
                      )}{" "}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(deal)}
                      >
                        Изменить
                      </Button>
                      <DeleteButton deal={deal} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialog.open} onOpenChange={(open) => !open && close()}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {dialog.deal ? "Редактирование сделки" : "Новая сделка"}
            </DialogTitle>
            <DialogDescription>
              Прибыль считается автоматически по мере заполнения.
            </DialogDescription>
          </DialogHeader>
          {dialog.open && (
            <DealForm
              platforms={platforms}
              itemNames={itemNames}
              baseCurrency={baseCurrency}
              deal={dialog.deal}
              initialWithSell={dialog.withSell}
              onDone={close}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
