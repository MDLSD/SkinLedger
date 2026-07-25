"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/native-select";
import { Button } from "@/components/ui/button";
import {
  buildPriceQuery,
  PRICE_TYPES,
  type PriceFilters,
} from "@/lib/prices/compare";

type SourceOption = { slug: string; title: string };

type Props = {
  filters: PriceFilters;
  sources: SourceOption[];
};

export function PricesToolbar({ filters, sources }: Props) {
  const router = useRouter();
  const pathname = usePathname();

  // Любая правка фильтра сбрасывает страницу на 1.
  const go = (overrides: Partial<PriceFilters>) => {
    router.replace(pathname + buildPriceQuery(filters, { ...overrides, page: 1 }), {
      scroll: false,
    });
  };

  // Числовые фильтры и поиск — с debounce 350 мс.
  const [q, setQ] = useState(filters.q);
  const [minPrice, setMinPrice] = useState(filters.minPrice);
  const [maxPrice, setMaxPrice] = useState(filters.maxPrice);
  const [minProfit, setMinProfit] = useState(filters.minProfit);
  const [minLiq, setMinLiq] = useState(filters.minLiq);
  useEffect(() => setQ(filters.q), [filters.q]);
  useEffect(() => setMinPrice(filters.minPrice), [filters.minPrice]);
  useEffect(() => setMaxPrice(filters.maxPrice), [filters.maxPrice]);
  useEffect(() => setMinProfit(filters.minProfit), [filters.minProfit]);
  useEffect(() => setMinLiq(filters.minLiq), [filters.minLiq]);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debounced = (overrides: Partial<PriceFilters>) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => go(overrides), 350);
  };

  const swap = () => go({ buy: filters.sell, sell: filters.buy });

  const isDefault =
    filters.buy === "buff163" &&
    filters.sell === "steam" &&
    filters.type === "min" &&
    !filters.q &&
    !filters.minPrice &&
    !filters.maxPrice &&
    !filters.minProfit &&
    !filters.minLiq;

  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="grid gap-1 text-xs text-muted-foreground">
        Купить на
        <NativeSelect
          className="w-40"
          value={filters.buy}
          onChange={(e) => go({ buy: e.target.value })}
        >
          {sources.map((s) => (
            <option key={s.slug} value={s.slug}>
              {s.title}
            </option>
          ))}
        </NativeSelect>
      </label>

      <Button
        variant="outline"
        size="icon"
        className="mb-0.5"
        title="Поменять площадки местами"
        onClick={swap}
      >
        <ArrowRight className="size-4" />
      </Button>

      <label className="grid gap-1 text-xs text-muted-foreground">
        Продать на
        <NativeSelect
          className="w-40"
          value={filters.sell}
          onChange={(e) => go({ sell: e.target.value })}
        >
          {sources.map((s) => (
            <option key={s.slug} value={s.slug}>
              {s.title}
            </option>
          ))}
        </NativeSelect>
      </label>

      <label className="grid gap-1 text-xs text-muted-foreground">
        Цена
        <NativeSelect
          className="w-40"
          value={filters.type}
          onChange={(e) => go({ type: e.target.value as PriceFilters["type"] })}
        >
          {PRICE_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </NativeSelect>
      </label>

      <label className="grid gap-1 text-xs text-muted-foreground">
        Поиск
        <Input
          className="h-8 w-44"
          placeholder="Название скина"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            debounced({ q: e.target.value });
          }}
        />
      </label>

      <label className="grid gap-1 text-xs text-muted-foreground">
        Цена, $ от
        <Input
          className="h-8 w-24"
          inputMode="decimal"
          placeholder="0"
          value={minPrice}
          onChange={(e) => {
            setMinPrice(e.target.value);
            debounced({ minPrice: e.target.value });
          }}
        />
      </label>

      <label className="grid gap-1 text-xs text-muted-foreground">
        до
        <Input
          className="h-8 w-24"
          inputMode="decimal"
          placeholder="∞"
          value={maxPrice}
          onChange={(e) => {
            setMaxPrice(e.target.value);
            debounced({ maxPrice: e.target.value });
          }}
        />
      </label>

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
