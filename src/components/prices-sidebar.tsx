"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowUpDown, ChevronLeft, ChevronRight, SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/native-select";
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

export function PricesSidebar({ filters, sources }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(true);

  const go = (overrides: Partial<PriceFilters>) => {
    router.replace(pathname + buildPriceQuery(filters, { ...overrides, page: 1 }), {
      scroll: false,
    });
  };

  const swap = () => go({ buy: filters.sell, sell: filters.buy });

  const SourceSelect = ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (v: string) => void;
  }) => (
    <NativeSelect value={value} onChange={(e) => onChange(e.target.value)}>
      {sources.map((s) => (
        <option key={s.slug} value={s.slug}>
          {s.title}
        </option>
      ))}
    </NativeSelect>
  );

  const TypeSelect = ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (v: string) => void;
  }) => (
    <NativeSelect value={value} onChange={(e) => onChange(e.target.value)}>
      {PRICE_TYPES.map((t) => (
        <option key={t.value} value={t.value}>
          {t.label}
        </option>
      ))}
    </NativeSelect>
  );

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:text-foreground"
        title="Показать настройки"
      >
        <ChevronRight className="size-4" />
      </button>
    );
  }

  return (
    <aside className="w-full shrink-0 lg:w-72">
      <div className="rounded-lg border border-border bg-card">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <SlidersHorizontal className="size-4 text-primary" />
          <h2 className="flex-1 text-sm font-semibold">Настройки таблицы</h2>
          <button
            onClick={() => setOpen(false)}
            className="text-muted-foreground transition-colors hover:text-foreground"
            title="Свернуть"
          >
            <ChevronLeft className="size-4" />
          </button>
        </div>

        <div className="space-y-5 p-4">
          {/* Сайт для закупки */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Сайт для закупки
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <label className="grid gap-1 text-xs text-muted-foreground">
                Откуда покупаем
                <SourceSelect value={filters.buy} onChange={(v) => go({ buy: v })} />
              </label>
              <label className="grid gap-1 text-xs text-muted-foreground">
                Тип цены
                <TypeSelect
                  value={filters.buyType}
                  onChange={(v) => go({ buyType: v as PriceFilters["buyType"] })}
                />
              </label>
              <label className="grid gap-1 text-xs text-muted-foreground">
                Мин. цена, $
                <Input
                  className="h-8"
                  inputMode="decimal"
                  placeholder="0"
                  defaultValue={filters.minPrice}
                  onBlur={(e) => e.target.value !== filters.minPrice && go({ minPrice: e.target.value })}
                  onKeyDown={(e) => e.key === "Enter" && go({ minPrice: e.currentTarget.value })}
                />
              </label>
              <label className="grid gap-1 text-xs text-muted-foreground">
                Макс. цена, $
                <Input
                  className="h-8"
                  inputMode="decimal"
                  placeholder="∞"
                  defaultValue={filters.maxPrice}
                  onBlur={(e) => e.target.value !== filters.maxPrice && go({ maxPrice: e.target.value })}
                  onKeyDown={(e) => e.key === "Enter" && go({ maxPrice: e.currentTarget.value })}
                />
              </label>
            </div>
          </section>

          {/* Свап площадок */}
          <div className="flex justify-center">
            <button
              onClick={swap}
              className="flex size-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:text-foreground"
              title="Поменять площадки местами"
            >
              <ArrowUpDown className="size-4" />
            </button>
          </div>

          {/* Сайт для продажи */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Сайт для продажи
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <label className="grid gap-1 text-xs text-muted-foreground">
                Куда продаём
                <SourceSelect value={filters.sell} onChange={(v) => go({ sell: v })} />
              </label>
              <label className="grid gap-1 text-xs text-muted-foreground">
                Тип цены
                <TypeSelect
                  value={filters.sellType}
                  onChange={(v) => go({ sellType: v as PriceFilters["sellType"] })}
                />
              </label>
            </div>
          </section>
        </div>
      </div>
    </aside>
  );
}
