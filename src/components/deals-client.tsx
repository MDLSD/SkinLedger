"use client";

import { useActionState, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
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
import { DealsToolbar } from "@/components/deals-toolbar";
import { deleteAllDealsAction, deleteDealAction } from "@/lib/actions/deals";
import {
  buyCostBase,
  formatMoney,
  formatPct,
  holdingDays,
  marginPct,
  profit,
  sellRevenueBase,
} from "@/lib/deal-math";
import {
  buildDealQuery,
  PAGE_SIZE,
  type DealFilters,
  type SortKey,
} from "@/lib/deal-list";
import type { Rates } from "@/lib/currency";
import type { DealDTO, PlatformDTO } from "@/lib/types";

function formatDate(d: string | null) {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${day}.${m}.${y}`;
}

// Цена за штуку в валюте сделки — ровно то, что вводил пользователь.
// В самой колонке стоит итог по партии с комиссией, поэтому цену показываем
// отдельной строкой, а не вместо неё.
function unitPrice(price: number | null, currency: string, quantity: number) {
  if (price == null) return null;
  return `${quantity > 1 ? `${quantity} × ` : ""}${formatMoney(price, currency)} · `;
}

function StatusBadge({ status }: { status: string }) {
  if (status === "sold") return <Badge>Продано</Badge>;
  if (status === "withdrawn_via_skin")
    return <Badge variant="outline">Вывод</Badge>;
  return <Badge variant="secondary">В холде</Badge>;
}

// Заголовок-сортировщик: клик по своей колонке инвертирует направление,
// по чужой — сортирует по ней (по убыванию), сбрасывая страницу на 1.
function SortHeader({
  col,
  label,
  filters,
  align,
}: {
  col: SortKey;
  label: string;
  filters: DealFilters;
  align?: "right";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const active = filters.sort === col;
  const nextDir = active && filters.dir === "desc" ? "asc" : "desc";

  return (
    <button
      type="button"
      className={`inline-flex items-center gap-1 font-medium hover:text-foreground ${
        active ? "text-foreground" : "text-muted-foreground"
      } ${align === "right" ? "flex-row-reverse" : ""}`}
      onClick={() =>
        router.replace(
          pathname + buildDealQuery(filters, { sort: col, dir: nextDir, page: 1 }),
          { scroll: false },
        )
      }
    >
      {label}
      {active ? (
        filters.dir === "desc" ? (
          <ArrowDown className="size-3.5" />
        ) : (
          <ArrowUp className="size-3.5" />
        )
      ) : (
        <ChevronsUpDown className="size-3.5 opacity-50" />
      )}
    </button>
  );
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

function DeleteAllButton({ total }: { total: number }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(deleteAllDealsAction, {});

  useEffect(() => {
    if (state.success) router.refresh();
  }, [state.success, router]);

  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={<Button variant="outline" className="text-destructive" />}
      >
        Удалить все
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Удалить все сделки?</AlertDialogTitle>
          <AlertDialogDescription>
            Будут безвозвратно удалены все ваши сделки ({total}). Это действие
            нельзя отменить.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Отмена</AlertDialogCancel>
          <form action={formAction}>
            <input type="hidden" name="confirm" value="yes" />
            <AlertDialogAction variant="destructive" type="submit" disabled={pending}>
              Удалить все
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
  baseCurrency: string;
  rates: Rates;
  filters: DealFilters;
  total: number;
  totalAll: number;
  pageCount: number;
};

export function DealsClient({
  deals,
  platforms,
  baseCurrency,
  rates,
  filters,
  total,
  totalAll,
  pageCount,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const goPage = (page: number) =>
    router.replace(pathname + buildDealQuery(filters, { page }), {
      scroll: false,
    });
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
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Сделки</h1>
        <div className="flex items-center gap-2">
          {totalAll > 0 && <DeleteAllButton total={totalAll} />}
          {total > 0 && (
            <Button
              variant="outline"
              // Рендерится как <a> (скачивание файла), а не нативный <button>.
              nativeButton={false}
              render={
                <a
                  href={`/api/deals/export${buildDealQuery(filters)}`}
                  download
                />
              }
            >
              Экспорт CSV
            </Button>
          )}
          <Button onClick={openCreate}>Добавить сделку</Button>
        </div>
      </div>

      <DealsToolbar filters={filters} platforms={platforms} />

      {deals.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          {total === 0 && filters.status === "all" && filters.platform === "all" &&
          filters.period === "all" && !filters.q
            ? "Пока нет сделок. Добавьте первую — и увидите прибыль ещё до сохранения."
            : "Под фильтры ничего не подошло. Измените или сбросьте фильтры."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <SortHeader col="item" label="Скин" filters={filters} />
                </TableHead>
                <TableHead>
                  <SortHeader col="buyPrice" label="Затраты" filters={filters} />
                </TableHead>
                <TableHead>
                  <SortHeader col="sellPrice" label="Выручка" filters={filters} />
                </TableHead>
                <TableHead className="text-right">
                  <SortHeader col="profit" label="Прибыль" filters={filters} align="right" />
                </TableHead>
                <TableHead className="text-right">
                  <SortHeader col="margin" label="Маржа" filters={filters} align="right" />
                </TableHead>
                <TableHead className="text-right">
                  <SortHeader col="days" label="Дней" filters={filters} align="right" />
                </TableHead>
                <TableHead>
                  <SortHeader col="status" label="Статус" filters={filters} />
                </TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {deals.map((deal) => {
                const p = profit(deal);
                const m = marginPct(deal);
                const sellRevenue = sellRevenueBase(deal);
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
                      {/* Вся партия с комиссией — в том же масштабе, что «Прибыль».
                          Цена за штуку ушла второй строкой к площадке и дате. */}
                      <div>{formatMoney(buyCostBase(deal), baseCurrency)}</div>
                      <div className="text-xs text-muted-foreground">
                        {unitPrice(deal.buyPrice, deal.buyCurrency, deal.quantity)}
                        {deal.buyPlatformName} · {formatDate(deal.buyDate)}
                      </div>
                    </TableCell>
                    <TableCell>
                      {sellRevenue == null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <>
                          <div>{formatMoney(sellRevenue, baseCurrency)}</div>
                          <div className="text-xs text-muted-foreground">
                            {unitPrice(
                              deal.sellPrice,
                              deal.sellCurrency ?? deal.buyCurrency,
                              deal.quantity,
                            )}
                            {deal.sellPlatformName} · {formatDate(deal.sellDate)}
                          </div>
                        </>
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
                      {/* У вывода маржа не имеет смысла — вместо неё показываем
                          зафиксированную при сохранении потерю на выводе. */}
                      {isWithdrawal ? (
                        deal.withdrawalDiscountPct == null ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <span className="text-amber-600" title="Потеря на выводе">
                            {formatPct(-deal.withdrawalDiscountPct)}
                          </span>
                        )
                      ) : m == null ? (
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

      {total > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Показаны {(filters.page - 1) * PAGE_SIZE + 1}–
            {Math.min(filters.page * PAGE_SIZE, total)} из {total}
          </span>
          {pageCount > 1 && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={filters.page <= 1}
                onClick={() => goPage(filters.page - 1)}
              >
                Назад
              </Button>
              <span>
                Стр. {filters.page} из {pageCount}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={filters.page >= pageCount}
                onClick={() => goPage(filters.page + 1)}
              >
                Вперёд
              </Button>
            </div>
          )}
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
              baseCurrency={baseCurrency}
              rates={rates}
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
