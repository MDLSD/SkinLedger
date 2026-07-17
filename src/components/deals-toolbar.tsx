"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/native-select";
import { Button } from "@/components/ui/button";
import { DateRangePicker } from "@/components/date-range-picker";
import {
  buildDealQuery,
  PERIOD_OPTIONS,
  STATUS_OPTIONS,
  type DealFilters,
} from "@/lib/deal-list";
import type { PlatformDTO } from "@/lib/types";

type Props = {
  filters: DealFilters;
  platforms: PlatformDTO[];
};

export function DealsToolbar({ filters, platforms }: Props) {
  const router = useRouter();
  const pathname = usePathname();

  // Навигация сбрасывает страницу на 1 (кроме явной пагинации).
  const go = (overrides: Partial<DealFilters>) => {
    router.replace(pathname + buildDealQuery(filters, { ...overrides, page: 1 }), {
      scroll: false,
    });
  };

  // Поиск с debounce 300 мс.
  const [q, setQ] = useState(filters.q);
  useEffect(() => setQ(filters.q), [filters.q]);
  const qTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onQ = (value: string) => {
    setQ(value);
    if (qTimer.current) clearTimeout(qTimer.current);
    qTimer.current = setTimeout(() => go({ q: value }), 300);
  };

  const isDefault =
    filters.period === "all" &&
    filters.status === "all" &&
    filters.platform === "all" &&
    !filters.q;

  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="grid gap-1 text-xs text-muted-foreground">
        Поиск
        <Input
          className="h-8 w-48"
          placeholder="Название скина"
          value={q}
          onChange={(e) => onQ(e.target.value)}
        />
      </label>

      <label className="grid gap-1 text-xs text-muted-foreground">
        Период
        <NativeSelect
          className="w-36"
          value={filters.period}
          onChange={(e) => go({ period: e.target.value as DealFilters["period"] })}
        >
          {PERIOD_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </NativeSelect>
      </label>

      {filters.period === "custom" && (
        <label className="grid gap-1 text-xs text-muted-foreground">
          Даты
          <DateRangePicker
            from={filters.from}
            to={filters.to}
            onChange={(from, to) => go({ from, to })}
          />
        </label>
      )}

      <label className="grid gap-1 text-xs text-muted-foreground">
        Статус
        <NativeSelect
          className="w-40"
          value={filters.status}
          onChange={(e) => go({ status: e.target.value })}
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </NativeSelect>
      </label>

      <label className="grid gap-1 text-xs text-muted-foreground">
        Площадка
        <NativeSelect
          className="w-48"
          value={filters.platform}
          onChange={(e) => go({ platform: e.target.value })}
        >
          <option value="all">Все площадки</option>
          {platforms.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </NativeSelect>
      </label>

      {!isDefault && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            router.replace(pathname, { scroll: false })
          }
        >
          Сбросить
        </Button>
      )}
    </div>
  );
}
