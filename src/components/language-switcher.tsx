"use client";

import { useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Переключатель языка. Остаёмся на том же экране: `usePathname` из
 * `@/i18n/navigation` отдаёт путь БЕЗ префикса локали, а `router.replace`
 * приписывает нужный. Строку запроса переносим руками — в ней живут фильтры
 * сделок и таблицы цен, и терять их при смене языка нельзя.
 */
export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations("common");
  const [pending, startTransition] = useTransition();

  const pick = (next: string) => {
    if (next === locale) return;
    const query = searchParams.toString();
    startTransition(() => {
      router.replace(`${pathname}${query ? `?${query}` : ""}`, {
        locale: next as (typeof routing.locales)[number],
      });
    });
  };

  return (
    <Select
      value={locale}
      onValueChange={(v) => pick(v as string)}
      items={routing.locales.map((l) => ({
        label: l.toUpperCase(),
        value: l,
      }))}
    >
      <SelectTrigger
        className={`h-9 w-20 ${pending ? "opacity-60" : ""}`}
        aria-label={t("language")}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false} align="end" className="p-1">
        {routing.locales.map((l) => (
          <SelectItem key={l} value={l} className="py-1.5">
            {t(`localeName.${l}`)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
