"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { EyeOff, Star } from "lucide-react";
import { setWatchState, type WatchKind } from "@/lib/actions/watchlist";

/**
 * Звезда «в избранное» и глаз «скрыть» в строке таблицы (ТЗ 3.1, колонка
 * «Избранное / +»). Состояние меняем сразу, не дожидаясь сервера: строка
 * из чёрного списка исчезает после обновления данных, и ждать нечего.
 */
export function WatchToggle({ item, state }: { item: string; state: WatchKind }) {
  const t = useTranslations("prices");
  const router = useRouter();
  const [local, setLocal] = useState<WatchKind>(state);
  const [pending, startTransition] = useTransition();

  const apply = (next: WatchKind) => {
    setLocal(next);
    startTransition(async () => {
      await setWatchState(item, next);
      router.refresh();
    });
  };

  const fav = local === "favorite";
  return (
    <span className={`flex items-center gap-1 ${pending ? "opacity-60" : ""}`}>
      <button
        type="button"
        onClick={() => apply(fav ? null : "favorite")}
        title={fav ? t("unfavorite") : t("favorite")}
        aria-label={fav ? t("unfavorite") : t("favorite")}
        aria-pressed={fav}
        className={`rounded p-1 transition-colors ${
          fav ? "text-[#f0a020]" : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <Star className="size-4" fill={fav ? "currentColor" : "none"} />
      </button>
      <button
        type="button"
        onClick={() => apply("blocked")}
        title={t("hideItem")}
        aria-label={t("hideItem")}
        className="rounded p-1 text-muted-foreground transition-colors hover:text-destructive"
      >
        <EyeOff className="size-4" />
      </button>
    </span>
  );
}
