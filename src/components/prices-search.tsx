"use client";

import { useRef, useState } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { Search } from "lucide-react";
import { buildPriceQuery, type PriceFilters } from "@/lib/prices/compare";

// Поиск по названию живёт прямо в шапке таблицы (как в референсе), поэтому
// это отдельный клиентский островок внутри серверной таблицы.
export function PricesSearch({ filters }: { filters: PriceFilters }) {
  const router = useRouter();
  const pathname = usePathname();
  // Синхронизация с URL без эффекта: если фильтр пришёл другой (кнопка
  // «Сбросить», навигация назад) — подхватываем его прямо в рендере.
  const [q, setQ] = useState(filters.q);
  const [fromUrl, setFromUrl] = useState(filters.q);
  if (fromUrl !== filters.q) {
    setFromUrl(filters.q);
    setQ(filters.q);
  }

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const go = (value: string) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      router.replace(pathname + buildPriceQuery(filters, { q: value, page: 1 }), {
        scroll: false,
      });
    }, 350);
  };

  return (
    <span className="flex items-center gap-2">
      <Search className="size-3.5 shrink-0 text-muted-foreground" />
      <input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          go(e.target.value);
        }}
        placeholder="Поиск по названию"
        aria-label="Поиск по названию"
        className="w-56 bg-transparent text-xs font-normal text-foreground outline-none placeholder:text-muted-foreground"
      />
    </span>
  );
}
