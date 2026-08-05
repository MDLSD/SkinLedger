"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { formatMoney } from "@/lib/deal-math";

type Quote = {
  low: number | null;
  lowTitle: string | null;
  median: number | null;
  count: number;
  platforms: { name: string; price: number | null; title: string | null }[];
};

type Props = {
  /** market_hash_name выбранного предмета; без него подсказки нет. */
  item: string | null;
  /** Название площадки этой стороны сделки — по ней ищем «свою» цену. */
  platform: string | null;
  /** Валюта поля цены и курс USD → эта валюта (котировки хранятся в USD). */
  currency: string;
  fx: number | null;
  onPick: (value: string) => void;
};

/**
 * Подсказка рыночной цены под полем цены в форме сделки (ТЗ 6). Показывает
 * цену на выбранной площадке, если она сопоставилась с источником цен, иначе
 * минимум по рынку; клик подставляет значение в поле.
 */
export function MarketPriceHint({ item, platform, currency, fx, onPick }: Props) {
  const t = useTranslations("dealForm");
  const locale = useLocale();
  const [data, setData] = useState<{ item: string; quote: Quote } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    if (!item) return;
    let alive = true;
    const params = new URLSearchParams({ item });
    if (platform) params.append("platform", platform);
    fetch(`/api/prices/quote?${params.toString()}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((q: Quote) => alive && setData({ item, quote: q }))
      .catch(() => alive && setFailed(item));
    return () => {
      alive = false;
    };
  }, [item, platform]);

  if (!item || failed === item) return null;
  const quote = data?.item === item ? data.quote : null;
  if (!quote || quote.count === 0) return null;

  // Цена на площадке сделки, если она известна; иначе минимум по рынку.
  const own = quote.platforms.find((p) => p.price != null);
  const usd = own?.price ?? quote.low;
  if (usd == null) return null;

  // Котировки хранятся в USD; поле цены — в валюте сделки.
  const factor = fx == null || currency === "USD" ? 1 : fx;
  const inCurrency = Math.round(usd * factor * 100) / 100;
  const money = (v: number) => formatMoney(v * factor, currency, locale);

  return (
    <p className="text-xs text-muted-foreground">
      {own
        ? t("marketOnPlatform", { platform: own.title ?? own.name, price: money(usd) })
        : t("marketLowest", { platform: quote.lowTitle ?? "", price: money(usd), count: quote.count })}{" "}
      <button
        type="button"
        onClick={() => onPick(String(inCurrency))}
        className="text-primary hover:underline"
      >
        {t("usePrice")}
      </button>
    </p>
  );
}
