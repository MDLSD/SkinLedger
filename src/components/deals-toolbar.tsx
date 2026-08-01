"use client";

import { useTranslations } from "next-intl";
import { withDynamicKeys } from "@/i18n/dynamic";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
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
  const t = useTranslations("dealsToolbar");
  const td = withDynamicKeys(t);
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
    <div className="space-y-2">
    <div className="flex flex-wrap items-end gap-3">
      <label className="grid gap-1 text-xs text-muted-foreground">
        {t("search")}
        <Input
          className="h-8 w-48"
          placeholder={t("searchPlaceholder")}
          value={q}
          onChange={(e) => onQ(e.target.value)}
        />
      </label>

      <label className="grid gap-1 text-xs text-muted-foreground">
        {t("period")}
        <NativeSelect
          className="w-36"
          value={filters.period}
          onChange={(e) => go({ period: e.target.value as DealFilters["period"] })}
        >
          {PERIOD_OPTIONS.map((o) => (
            <option key={o} value={o}>
              {td(`periodOption.${o}`)}
            </option>
          ))}
        </NativeSelect>
      </label>

      {filters.period === "custom" && (
        <label className="grid gap-1 text-xs text-muted-foreground">
          {t("dates")}
          <DateRangePicker
            from={filters.from}
            to={filters.to}
            onChange={(f, t) => go({ from: f, to: t })}
          />
        </label>
      )}

      <label className="grid gap-1 text-xs text-muted-foreground">
        {t("status")}
        <NativeSelect
          className="w-40"
          value={filters.status}
          onChange={(e) => go({ status: e.target.value })}
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o} value={o}>
              {td(`statusOption.${o}`)}
            </option>
          ))}
        </NativeSelect>
      </label>

      <label className="grid gap-1 text-xs text-muted-foreground">
        {t("platform")}
        <NativeSelect
          className="w-48"
          value={filters.platform}
          onChange={(e) => go({ platform: e.target.value })}
        >
          <option value="all">{t("allPlatforms")}</option>
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
          {t("reset")}
        </Button>
      )}
    </div>

      {filters.period !== "all" && filters.status !== "holding" && (
        <p className="text-xs text-muted-foreground">
          {t("periodNote")}
        </p>
      )}
    </div>
  );
}
