"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { PriceRow } from "@/components/prices-row";
import { TableCell, TableRow } from "@/components/ui/table";
import type { ComparisonRow } from "@/lib/prices/compare";

type Props = {
  initial: ComparisonRow[];
  /** Строка запроса страницы: те же фильтры уходят в догрузку. */
  query: string;
  hasMore: boolean;
  buy: string;
  sell: string;
  buyTitle: string;
  sellTitle: string;
  cur: string;
  fx: number | null;
  now: number;
  colSpan: number;
  charts: boolean;
};

// Дата после JSON приезжает строкой — возвращаем её в Date, чтобы строке
// таблицы было всё равно, откуда она пришла.
type RawRow = Omit<ComparisonRow, "buyFetchedAt" | "sellFetchedAt"> & {
  buyFetchedAt: string;
  sellFetchedAt: string;
};
const revive = (r: RawRow): ComparisonRow => ({
  ...r,
  buyFetchedAt: new Date(r.buyFetchedAt),
  sellFetchedAt: new Date(r.sellFetchedAt),
});

/**
 * Тело таблицы одной лентой: следующие полсотни строк подгружаются, когда
 * пользователь досматривает до конца списка. Страниц наружу нет — они
 * остались только протоколом догрузки.
 */
export function PricesRows({ initial, query, hasMore, colSpan, ...row }: Props) {
  const t = useTranslations("prices");
  const [rows, setRows] = useState(initial);
  const [page, setPage] = useState(1);
  const [more, setMore] = useState(hasMore);
  const [failed, setFailed] = useState(false);
  const loading = useRef(false);
  const sentinel = useRef<HTMLTableRowElement>(null);

  // Смена фильтров = новый серверный рендер: сбрасываем ленту к первой
  // странице. Синхронизация в рендере, а не в эффекте, — иначе кадр
  // отрисовался бы со старым списком.
  const [seen, setSeen] = useState(initial);
  if (seen !== initial) {
    setSeen(initial);
    setRows(initial);
    setPage(1);
    setMore(hasMore);
    setFailed(false);
  }

  const loadMore = useCallback(async () => {
    if (loading.current) return;
    loading.current = true;
    const next = page + 1;
    const sep = query ? "&" : "?";
    try {
      const res = await fetch(`/api/prices/rows${query}${sep}page=${next}`);
      if (!res.ok) throw new Error(String(res.status));
      const data: { rows: RawRow[]; hasMore: boolean } = await res.json();
      setRows((prev) => [...prev, ...data.rows.map(revive)]);
      setPage(next);
      setMore(data.hasMore);
    } catch {
      // Молча не докручиваем: показываем кнопку «Загрузить ещё».
      setFailed(true);
    } finally {
      loading.current = false;
    }
  }, [page, query]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || !more || failed) return;
    // rootMargin: подгружаем чуть раньше, чем лента упрётся в конец.
    const io = new IntersectionObserver(
      (entries) => entries[0]?.isIntersecting && void loadMore(),
      { rootMargin: "400px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [more, failed, loadMore]);

  return (
    <>
      {rows.map((r) => (
        <PriceRow key={r.marketHashName} r={r} colSpan={colSpan} {...row} />
      ))}
      {more && (
        <TableRow ref={sentinel} className="hover:bg-transparent">
          <TableCell colSpan={colSpan} className="py-4 text-center text-xs text-muted-foreground">
            {failed ? (
              <button
                type="button"
                onClick={() => {
                  setFailed(false);
                  void loadMore();
                }}
                className="text-primary hover:underline"
              >
                {t("loadMore")}
              </button>
            ) : (
              t("loading")
            )}
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
