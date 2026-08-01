"use client";

import { useTranslations } from "next-intl";

import { useRef, useState } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { NumberInput } from "@/components/number-input";
import { buildPriceQuery, type PriceFilters } from "@/lib/prices/compare";

type Props = { filters: PriceFilters };

export function PricesFilterBar({ filters }: Props) {
  const t = useTranslations("prices");
  const router = useRouter();
  const pathname = usePathname();

  const go = (overrides: Partial<PriceFilters>) => {
    router.replace(pathname + buildPriceQuery(filters, { ...overrides, page: 1 }), {
      scroll: false,
    });
  };

  // Синхронизация с URL без эффекта: значения меняются извне (сброс фильтров,
  // выбор шаблона, навигация назад) — подхватываем прямо в рендере.
  const [minProfit, setMinProfit] = useState(filters.minProfit);
  const [minLiq, setMinLiq] = useState(filters.minLiq);
  const [fromUrl, setFromUrl] = useState({ p: filters.minProfit, l: filters.minLiq });
  if (fromUrl.p !== filters.minProfit || fromUrl.l !== filters.minLiq) {
    setFromUrl({ p: filters.minProfit, l: filters.minLiq });
    setMinProfit(filters.minProfit);
    setMinLiq(filters.minLiq);
  }

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debounced = (overrides: Partial<PriceFilters>) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => go(overrides), 350);
  };

  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="grid gap-1 text-xs text-muted-foreground">
        {t("marginAtLeast")}
        <NumberInput
          className="h-8 w-24"
          placeholder="0"
          value={minProfit}
          onChange={(e) => {
            setMinProfit(e.target.value);
            debounced({ minProfit: e.target.value });
          }}
        />
      </label>

      <label className="grid gap-1 text-xs text-muted-foreground">
        {t("salesAtLeast")}
        <NumberInput
          className="h-8 w-24"
          decimal={false}
          placeholder="0"
          value={minLiq}
          onChange={(e) => {
            setMinLiq(e.target.value);
            debounced({ minLiq: e.target.value });
          }}
        />
      </label>

    </div>
  );
}
