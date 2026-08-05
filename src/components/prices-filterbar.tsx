"use client";

import { useTranslations } from "next-intl";

import { useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { Eye, Star } from "lucide-react";
import { NumberInput } from "@/components/number-input";
import { clearHiddenItems } from "@/lib/actions/watchlist";
import { buildPriceQuery, type PriceFilters } from "@/lib/prices/compare";

type Props = {
  filters: PriceFilters;
  /** Сколько предметов пользователь скрыл: без счётчика их не вернуть. */
  hidden: number;
};

export function PricesFilterBar({ filters, hidden }: Props) {
  const t = useTranslations("prices");
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();

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

  const onUnhide = () => {
    startTransition(async () => {
      await clearHiddenItems();
      router.refresh();
    });
  };

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

      {/* Режим просмотра, а не настройка: в шаблон профиля не сохраняется. */}
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
        {t("onlyFavorites")}
      </button>

      {hidden > 0 && (
        <button
          type="button"
          onClick={onUnhide}
          title={t("hiddenHint")}
          className="flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <Eye className="size-3.5" />
          {t("unhideAll", { count: hidden })}
        </button>
      )}
    </div>
  );
}
