"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { buildPriceQuery, type PriceFilters } from "@/lib/prices/compare";

type Props = { filters: PriceFilters };

export function PricesFilterBar({ filters }: Props) {
  const router = useRouter();
  const pathname = usePathname();

  const go = (overrides: Partial<PriceFilters>) => {
    router.replace(pathname + buildPriceQuery(filters, { ...overrides, page: 1 }), {
      scroll: false,
    });
  };

  const [minProfit, setMinProfit] = useState(filters.minProfit);
  const [minLiq, setMinLiq] = useState(filters.minLiq);
  useEffect(() => setMinProfit(filters.minProfit), [filters.minProfit]);
  useEffect(() => setMinLiq(filters.minLiq), [filters.minLiq]);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debounced = (overrides: Partial<PriceFilters>) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => go(overrides), 350);
  };

  const isDefault =
    filters.buy === "buff163" &&
    filters.sell === "steam" &&
    filters.buyType === "min" &&
    filters.sellType === "min" &&
    !filters.q &&
    !filters.minPrice &&
    !filters.maxPrice &&
    !filters.minProfit &&
    !filters.minLiq;

  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="grid gap-1 text-xs text-muted-foreground">
        Маржа ≥ %
        <Input
          className="h-8 w-24"
          inputMode="decimal"
          placeholder="0"
          value={minProfit}
          onChange={(e) => {
            setMinProfit(e.target.value);
            debounced({ minProfit: e.target.value });
          }}
        />
      </label>

      <label className="grid gap-1 text-xs text-muted-foreground">
        Продаж/30д ≥
        <Input
          className="h-8 w-24"
          inputMode="numeric"
          placeholder="0"
          value={minLiq}
          onChange={(e) => {
            setMinLiq(e.target.value);
            debounced({ minLiq: e.target.value });
          }}
        />
      </label>

      {!isDefault && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.replace(pathname, { scroll: false })}
        >
          Сбросить
        </Button>
      )}
    </div>
  );
}
