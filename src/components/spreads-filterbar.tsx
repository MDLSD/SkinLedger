"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { Search, Star } from "lucide-react";
import { NumberInput } from "@/components/number-input";
import { buildSpreadQuery, type SpreadFilters } from "@/lib/prices/spreads";

/** Фильтры страницы связок. Всё живёт в адресе — ссылкой можно поделиться. */
export function SpreadsFilterBar({ filters }: { filters: SpreadFilters }) {
  const t = useTranslations("spreads");
  const tp = useTranslations("prices");
  const router = useRouter();
  const pathname = usePathname();

  const go = (overrides: Partial<SpreadFilters>) => {
    router.replace(pathname + buildSpreadQuery(filters, { ...overrides, page: 1 }), {
      scroll: false,
    });
  };

  // Синхронизация с адресом в рендере: значения меняет и «Сбросить», и переход назад.
  const [local, setLocal] = useState({
    q: filters.q,
    minProfit: filters.minProfit,
    minLiq: filters.minLiq,
    minPrice: filters.minPrice,
    maxPrice: filters.maxPrice,
  });
  const [fromUrl, setFromUrl] = useState(local);
  const current = {
    q: filters.q,
    minProfit: filters.minProfit,
    minLiq: filters.minLiq,
    minPrice: filters.minPrice,
    maxPrice: filters.maxPrice,
  };
  if (JSON.stringify(fromUrl) !== JSON.stringify(current)) {
    setFromUrl(current);
    setLocal(current);
  }

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debounced = (overrides: Partial<SpreadFilters>) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => go(overrides), 350);
  };

  const field = (key: keyof typeof local, label: string, decimal = true, width = "w-24") => (
    <label className="grid gap-1 text-xs text-muted-foreground">
      {label}
      <NumberInput
        className={`h-8 ${width}`}
        decimal={decimal}
        placeholder="0"
        value={local[key]}
        onChange={(e) => {
          setLocal({ ...local, [key]: e.target.value });
          debounced({ [key]: e.target.value } as Partial<SpreadFilters>);
        }}
      />
    </label>
  );

  const dirty =
    filters.q ||
    filters.minProfit ||
    filters.minLiq ||
    filters.minPrice ||
    filters.maxPrice ||
    filters.fav;

  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="grid gap-1 text-xs text-muted-foreground">
        {t("search")}
        <span className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={local.q}
            onChange={(e) => {
              setLocal({ ...local, q: e.target.value });
              debounced({ q: e.target.value });
            }}
            placeholder={t("searchPlaceholder")}
            className="h-8 w-56 rounded-lg border border-border bg-transparent pr-2.5 pl-8 text-sm outline-none transition-colors focus:border-primary/60"
          />
        </span>
      </label>

      {field("minProfit", t("marginAtLeast"))}
      {field("minLiq", t("salesAtLeast"), false)}
      {field("minPrice", t("priceFrom"))}
      {field("maxPrice", t("priceTo"))}

      <button
        type="button"
        onClick={() => go({ fav: !filters.fav })}
        aria-pressed={filters.fav}
        className={`flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs transition-colors ${
          filters.fav
            ? "border-[#f0a020]/60 bg-[#f0a020]/10 text-foreground"
            : "border-border text-muted-foreground hover:text-foreground"
        }`}
      >
        <Star className="size-3.5" fill={filters.fav ? "currentColor" : "none"} />
        {tp("onlyFavorites")}
      </button>

      {dirty && (
        <button
          type="button"
          onClick={() => router.replace(pathname, { scroll: false })}
          className="h-8 rounded-lg px-2.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          {t("reset")}
        </button>
      )}
    </div>
  );
}
