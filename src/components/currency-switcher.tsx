"use client";

import { useTranslations } from "next-intl";

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { setDisplayCurrency } from "@/lib/actions/display-currency";
import { CURRENCY_SYMBOL } from "@/lib/currency";
import { BASE_CURRENCIES } from "@/lib/validation";

/** Валюта отображения в шапке. У вошедшего это же — валюта учёта в настройках. */
export function CurrencySwitcher({ current }: { current: string }) {
  const t = useTranslations("common");
  const router = useRouter();
  const [value, setValue] = useState(current);
  const [pending, startTransition] = useTransition();

  const pick = (next: string) => {
    setValue(next);
    startTransition(async () => {
      await setDisplayCurrency(next);
      // Цены считаются на сервере, поэтому страницу надо перерисовать.
      router.refresh();
    });
  };

  return (
    <Select
      value={value}
      onValueChange={(v) => pick(v as string)}
      items={BASE_CURRENCIES.map((c) => ({ label: `${CURRENCY_SYMBOL[c] ?? ""} ${c}`, value: c }))}
    >
      <SelectTrigger
        className={`h-9 w-24 ${pending ? "opacity-60" : ""}`}
        aria-label={t("currency")}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false} align="end" className="p-1">
        {BASE_CURRENCIES.map((c) => (
          <SelectItem key={c} value={c} className="py-1.5">
            {CURRENCY_SYMBOL[c] ?? ""} {c}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
