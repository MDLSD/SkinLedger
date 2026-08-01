"use client";

import { useLocale, useTranslations } from "next-intl";

import { useState } from "react";
import { SourceIcon } from "@/components/source-icon";
import { formatMoney } from "@/lib/deal-math";

type Offer = {
  slug: string;
  title: string;
  price: number;
  offers: number | null;
  sales30d: number | null;
};

// Сколько площадок показываем до нажатия «Показать все» — как в референсе,
// где список свёрнут до пяти строк.
const VISIBLE = 5;

export function SkinOffers({
  offers,
  cur,
  fx,
}: {
  offers: Offer[];
  cur: string;
  fx: number | null;
}) {
  const t = useTranslations("offers");
  const locale = useLocale();
  const [asc, setAsc] = useState(true);
  const [all, setAll] = useState(false);
  const money = (usd: number) =>
    fx == null || cur === "USD" ? formatMoney(usd, "USD", locale) : formatMoney(usd * fx, cur, locale);

  const sorted = [...offers].sort((a, b) => (asc ? a.price - b.price : b.price - a.price));
  const shown = all ? sorted : sorted.slice(0, VISIBLE);
  const rest = sorted.length - shown.length;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {t("sortBy")}
        <button
          type="button"
          onClick={() => setAsc((v) => !v)}
          className="rounded-lg border border-border px-2.5 py-1 text-foreground transition-colors hover:border-primary/60"
        >
          {asc ? t("cheapFirst") : t("expensiveFirst")}
        </button>
      </div>

      <ul className="space-y-2">
        {shown.map((o, i) => (
          <li
            key={o.slug}
            className="flex items-center gap-3 rounded-lg border border-border/60 px-3 py-2"
          >
            <SourceIcon slug={o.slug} title={o.title} className="size-8 text-[11px]" />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="truncate text-sm font-medium">{o.title}</span>
                {asc && i === 0 && (
                  <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] text-primary">
                    {t("cheapest")}
                  </span>
                )}
              </span>
              <span className="block text-xs text-muted-foreground">
                {o.offers != null ? t("offersCount", { count: o.offers }) : "—"}
                {o.sales30d != null && ` · ${t("sales30d", { count: o.sales30d })}`}
              </span>
            </span>
            <span className="text-right tabular-nums">
              <span className="block text-xs text-muted-foreground">{t("startingAt")}</span>
              <span className="block text-sm font-semibold">{money(o.price)}</span>
            </span>
          </li>
        ))}
      </ul>

      {rest > 0 && (
        <button
          type="button"
          onClick={() => setAll(true)}
          className="w-full rounded-lg border border-border py-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          {t("showMore", { count: rest })}
        </button>
      )}
    </div>
  );
}
