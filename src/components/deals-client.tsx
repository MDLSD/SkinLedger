"use client";

import { useActionState, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { ArrowDown, ArrowUp, Check, ChevronsUpDown, Lock } from "lucide-react";
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
function unitPrice(
  price: number | null,
  currency: string,
  quantity: number,
  locale: string,
) {
  if (price == null) return null;
  return `${quantity > 1 ? `${quantity} × ` : ""}${formatMoney(price, currency, locale)} · `;
}

function StatusBadge({ status }: { status: string }) {
  const t = useTranslations("deals");
  if (status === "sold") return <Badge>{t("statusSold")}</Badge>;
  return <Badge variant="secondary">{t("statusHolding")}</Badge>;
}

const TRADE_LOCK_DAYS = 7;

// Маркер трейд-бана Steam (7 дней после покупки/обмена на площадке): показывает,
// сколько ждать до продажи, или что предмет уже можно продавать.
function TradeLock({ buyDate }: { buyDate: string }) {
  const t = useTranslations("deals");
  const bought = new Date(`${buyDate}T00:00:00`).getTime();
  const elapsed = Math.floor((Date.now() - bought) / 86_400_000);
  const left = TRADE_LOCK_DAYS - elapsed;
  if (left > 0) {
    return (
      <span
        className="inline-flex items-center gap-1 text-xs text-amber-400"
        title={t("tradeBanLeft", { count: left })}
      >
        <Lock className="size-3" />
        {t("daysShort", { count: left })}
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1 text-xs text-emerald-400"
      title={t("tradeBanOver")}
    >
      <Check className="size-3" />
      {t("canSell")}
    </span>
  );
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
  const t = useTranslations("deals");
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
        {t("delete")}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("deleteTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("deleteBody", { name: deal.itemName })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
          <form action={formAction}>
            <input type="hidden" name="dealId" value={deal.id} />
            <AlertDialogAction variant="destructive" type="submit" disabled={pending}>
              {t("delete")}
            </AlertDialogAction>
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function DeleteAllButton({ total }: { total: number }) {
  const t = useTranslations("deals");
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
        {t("deleteAll")}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("deleteAllTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("deleteAllBody", { total })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
          <form action={formAction}>
            <input type="hidden" name="confirm" value="yes" />
            <AlertDialogAction variant="destructive" type="submit" disabled={pending}>
              {t("deleteAll")}
            </AlertDialogAction>
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// Карточка сделки для мобильной версии (вместо строки таблицы).
function DealCard({
  deal,
  baseCurrency,
  onSell,
  onEdit,
}: {
  deal: DealDTO;
  baseCurrency: string;
  onSell: () => void;
  onEdit: () => void;
}) {
  const t = useTranslations("deals");
  const locale = useLocale();
  const p = profit(deal);
  const m = marginPct(deal);
  const sellRevenue = sellRevenueBase(deal);
  const profitColor =
    p != null && p >= 0 ? "text-emerald-400" : "text-red-400";

  return (
    <div className="space-y-3 rounded-lg border bg-card p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-medium">
            {deal.itemName}
            {deal.quantity > 1 && (
              <span className="text-muted-foreground"> ×{deal.quantity}</span>
            )}
          </div>
          {deal.itemQuality && (
            <div className="text-xs text-muted-foreground">{deal.itemQuality}</div>
          )}
        </div>
        <div className="flex flex-col items-end gap-1">
          <StatusBadge status={deal.status} />
          {deal.status === "holding" && <TradeLock buyDate={deal.buyDate} />}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <div className="text-xs text-muted-foreground">{t("buy")}</div>
          <div>{formatMoney(buyCostBase(deal), baseCurrency, locale)}</div>
          <div className="text-xs text-muted-foreground">
            {unitPrice(deal.buyPrice, deal.buyCurrency, deal.quantity, locale)}
            {deal.buyPlatformName} · {formatDate(deal.buyDate)}
          </div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">{t("sell")}</div>
          {sellRevenue == null ? (
            <span className="text-muted-foreground">—</span>
          ) : (
            <>
              <div>{formatMoney(sellRevenue, baseCurrency, locale)}</div>
              <div className="text-xs text-muted-foreground">
                {unitPrice(
                  deal.sellPrice,
                  deal.sellCurrency ?? deal.buyCurrency,
                  deal.quantity,
                  locale,
                )}
                {deal.sellPlatformName} · {formatDate(deal.sellDate)}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 text-sm">
        <span className="text-muted-foreground">{t("profit")}</span>
        <span className={`font-medium ${profitColor}`}>
          {p == null ? "—" : formatMoney(p, baseCurrency, locale, true)}
        </span>
        <span className="text-muted-foreground">
          {m == null ? "" : `· ${formatPct(m, locale)}`}
        </span>
        <span className="ml-auto text-xs text-muted-foreground">
          {t("daysShort", { count: holdingDays(deal.buyDate, deal.sellDate) })}
        </span>
      </div>

      <div className="flex flex-wrap gap-1">
        {deal.status === "holding" && (
          <Button variant="outline" size="sm" onClick={onSell}>
            {t("sold")}
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={onEdit}>
          {t("edit")}
        </Button>
        <DeleteButton deal={deal} />
      </div>
    </div>
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
  const t = useTranslations("deals");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const goPage = (page: number) =>
    router.replace(pathname + buildDealQuery(filters, { page }), {
      scroll: false,
    });
  // Локаль параметром: пути под /api не локализуются, а заголовки колонок
  // и десятичный разделитель в выгрузке зависят от языка.
  const exportQuery = buildDealQuery(filters);
  const exportHref = `/api/deals/export${exportQuery ? `${exportQuery}&` : "?"}locale=${locale}`;
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <div className="flex flex-wrap items-center gap-2">
          {totalAll > 0 && <DeleteAllButton total={totalAll} />}
          {total > 0 && (
            <Button
              variant="outline"
              // Рендерится как <a> (скачивание файла), а не нативный <button>.
              nativeButton={false}
              render={
                <a href={exportHref} download />
              }
            >
              {t("exportCsv")}
            </Button>
          )}
          <Button onClick={openCreate}>{t("addDeal")}</Button>
        </div>
      </div>

      <DealsToolbar filters={filters} platforms={platforms} />

      {deals.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          {total === 0 && filters.status === "all" && filters.platform === "all" &&
          filters.period === "all" && !filters.q
            ? t("emptyNoDeals")
            : t("emptyNoMatch")}
        </p>
      ) : (
        <>
        {/* Десктоп — таблица, мобилка — карточки. */}
        <div className="hidden overflow-x-auto rounded-lg border bg-card md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <SortHeader col="item" label={t("colItem")} filters={filters} />
                </TableHead>
                <TableHead>
                  <SortHeader col="buyPrice" label={t("buy")} filters={filters} />
                </TableHead>
                <TableHead>
                  <SortHeader col="sellPrice" label={t("sell")} filters={filters} />
                </TableHead>
                <TableHead className="text-right">
                  <SortHeader col="profit" label={t("profit")} filters={filters} align="right" />
                </TableHead>
                <TableHead className="text-right">
                  <SortHeader col="margin" label={t("margin")} filters={filters} align="right" />
                </TableHead>
                <TableHead className="text-right">
                  <SortHeader col="days" label={t("colDays")} filters={filters} align="right" />
                </TableHead>
                <TableHead>
                  <SortHeader col="status" label={t("colStatus")} filters={filters} />
                </TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {deals.map((deal) => {
                const p = profit(deal);
                const m = marginPct(deal);
                const sellRevenue = sellRevenueBase(deal);
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
                      <div>{formatMoney(buyCostBase(deal), baseCurrency, locale)}</div>
                      <div className="text-xs text-muted-foreground">
                        {unitPrice(deal.buyPrice, deal.buyCurrency, deal.quantity, locale)}
                        {deal.buyPlatformName} · {formatDate(deal.buyDate)}
                      </div>
                    </TableCell>
                    <TableCell>
                      {sellRevenue == null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <>
                          <div>{formatMoney(sellRevenue, baseCurrency, locale)}</div>
                          <div className="text-xs text-muted-foreground">
                            {unitPrice(
                              deal.sellPrice,
                              deal.sellCurrency ?? deal.buyCurrency,
                              deal.quantity,
                              locale,
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
                          className={p >= 0 ? "text-emerald-400" : "text-red-400"}
                        >
                          {formatMoney(p, baseCurrency, locale, true)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {m == null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        formatPct(m, locale)
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {holdingDays(deal.buyDate, deal.sellDate)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col items-start gap-1">
                        <StatusBadge status={deal.status} />
                        {deal.status === "holding" && (
                          <TradeLock buyDate={deal.buyDate} />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right">
                      {deal.status === "holding" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openSell(deal)}
                        >
                          {t("sold")}
                        </Button>
                      )}{" "}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(deal)}
                      >
                        {t("edit")}
                      </Button>
                      <DeleteButton deal={deal} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <div className="space-y-3 md:hidden">
          {deals.map((deal) => (
            <DealCard
              key={deal.id}
              deal={deal}
              baseCurrency={baseCurrency}
              onSell={() => openSell(deal)}
              onEdit={() => openEdit(deal)}
            />
          ))}
        </div>
        </>
      )}

      {total > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {t("shownRange", {
              from: (filters.page - 1) * PAGE_SIZE + 1,
              to: Math.min(filters.page * PAGE_SIZE, total),
              total,
            })}
          </span>
          {pageCount > 1 && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={filters.page <= 1}
                onClick={() => goPage(filters.page - 1)}
              >
                {t("prev")}
              </Button>
              <span>
                {t("pageOf", { page: filters.page, pages: pageCount })}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={filters.page >= pageCount}
                onClick={() => goPage(filters.page + 1)}
              >
                {t("next")}
              </Button>
            </div>
          )}
        </div>
      )}

      <Dialog open={dialog.open} onOpenChange={(open) => !open && close()}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {dialog.deal ? t("editDeal") : t("newDeal")}
            </DialogTitle>
            <DialogDescription>
              {t("dialogHint")}
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
