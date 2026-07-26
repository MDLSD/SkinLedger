"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowUpDown, ChevronLeft, ChevronRight, SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { SourceIcon } from "@/components/source-icon";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

// Панель липнет под шапкой и занимает всю высоту экрана: при скролле таблицы
// настройки остаются на месте. Высота шапки — --app-header-h из globals.css.
const STICKY =
  "lg:sticky lg:top-(--app-header-h) lg:-my-6 lg:h-[calc(100dvh-var(--app-header-h))]";

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
  const titleOf = (slug: string) => sources.find((s) => s.slug === slug)?.title ?? slug;

  const SourceSelect = ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (v: string) => void;
  }) => (
    <Select
      value={value}
      onValueChange={(v) => onChange(v as string)}
      items={sources.map((s) => ({ label: s.title, value: s.slug }))}
    >
      <SelectTrigger className="h-9 w-full min-w-0">
        <SelectValue>
          {(v: string) => (
            <span className="flex min-w-0 items-center gap-2">
              <SourceIcon slug={v} title={titleOf(v)} />
              <span className="truncate">{titleOf(v)}</span>
            </span>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false} className="max-h-72 p-1">
        {sources.map((s) => (
          <SelectItem key={s.slug} value={s.slug} className="py-1.5">
            <SourceIcon slug={s.slug} title={s.title} />
            {s.title}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  const TypeSelect = ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (v: string) => void;
  }) => (
    <Select
      value={value}
      onValueChange={(v) => onChange(v as string)}
      items={PRICE_TYPES.map((t) => ({ label: t.label, value: t.value }))}
    >
      <SelectTrigger className="h-9 w-full min-w-0">
        <SelectValue />
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false} className="p-1">
        {PRICE_TYPES.map((t) => (
          <SelectItem key={t.value} value={t.value} className="py-1.5">
            {t.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  if (!open) {
    return (
      <aside
        className={`${STICKY} shrink-0 lg:-ml-8 lg:w-14 lg:border-r lg:border-border lg:bg-card`}
      >
        <button
          onClick={() => setOpen(true)}
          className="flex size-10 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:text-foreground lg:mt-6 lg:ml-1"
          title="Показать настройки"
        >
          <ChevronRight className="size-4" />
        </button>
      </aside>
    );
  }

  return (
    <aside
      className={`${STICKY} w-full shrink-0 lg:-ml-8 lg:w-96 lg:border-r lg:border-border lg:bg-card`}
    >
      <div className="flex h-full flex-col rounded-lg border border-border bg-card lg:rounded-none lg:border-0">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3 lg:pl-8">
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

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 lg:pl-8">
          {/* Сайт для закупки */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Сайт для закупки
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <label className="grid min-w-0 gap-1 text-xs text-muted-foreground">
                Откуда покупаем
                <SourceSelect value={filters.buy} onChange={(v) => go({ buy: v })} />
              </label>
              <label className="grid min-w-0 gap-1 text-xs text-muted-foreground">
                Тип цены
                <TypeSelect
                  value={filters.buyType}
                  onChange={(v) => go({ buyType: v as PriceFilters["buyType"] })}
                />
              </label>
              <label className="grid min-w-0 gap-1 text-xs text-muted-foreground">
                Мин. цена, $
                <Input
                  className="h-9"
                  inputMode="decimal"
                  placeholder="0"
                  defaultValue={filters.minPrice}
                  onBlur={(e) => e.target.value !== filters.minPrice && go({ minPrice: e.target.value })}
                  onKeyDown={(e) => e.key === "Enter" && go({ minPrice: e.currentTarget.value })}
                />
              </label>
              <label className="grid min-w-0 gap-1 text-xs text-muted-foreground">
                Макс. цена, $
                <Input
                  className="h-9"
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
              <label className="grid min-w-0 gap-1 text-xs text-muted-foreground">
                Куда продаём
                <SourceSelect value={filters.sell} onChange={(v) => go({ sell: v })} />
              </label>
              <label className="grid min-w-0 gap-1 text-xs text-muted-foreground">
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
