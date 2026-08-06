"use client";

import { useTranslations } from "next-intl";
import { withDynamicKeys } from "@/i18n/dynamic";

import { useActionState, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import {
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Plus,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/number-input";
import { Button } from "@/components/ui/button";
import { SourceIcon } from "@/components/source-icon";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  savePriceProfile,
  deletePriceProfile,
  updatePriceProfileQuery,
} from "@/lib/actions/price-profiles";
import {
  buildPriceQuery,
  PRICE_TYPES,
  profileQuery,
  swapSides,
  type PriceFilters,
} from "@/lib/prices/compare";

/** locked — площадка есть, но недоступна тарифу (ТЗ 6). */
type SourceOption = { slug: string; title: string; locked?: boolean };
type Profile = { id: string; name: string; query: string };
type Go = (overrides: Partial<PriceFilters>) => void;

type Props = {
  filters: PriceFilters;
  sources: SourceOption[];
  profiles: Profile[];
};

// Панель липнет под шапкой и занимает всю высоту экрана: при скролле таблицы
// настройки остаются на месте. Высота шапки — --app-header-h из globals.css.
const STICKY =
  "lg:sticky lg:top-(--app-header-h) lg:-my-6 lg:h-[calc(100dvh-var(--app-header-h))]";

const titleOf = (sources: SourceOption[], slug: string) =>
  sources.find((s) => s.slug === slug)?.title ?? slug;

function SourceSelect({
  value,
  sources,
  onChange,
}: {
  value: string;
  sources: SourceOption[];
  onChange: (v: string) => void;
}) {
  const tb = useTranslations("billing");
  return (
    <Select
      value={value}
      onValueChange={(v) => onChange(v as string)}
      items={sources.map((s) => ({ label: s.title, value: s.slug }))}
    >
      <SelectTrigger className="h-10 w-full min-w-0">
        <SelectValue>
          {(v: string) => (
            <span className="flex min-w-0 items-center gap-2">
              <SourceIcon
                slug={v}
                title={titleOf(sources, v)}
                className="size-7 text-[11px]"
              />
              <span className="truncate">{titleOf(sources, v)}</span>
            </span>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false} className="max-h-80 p-1">
        {/* Недоступные тарифу площадки остаются в списке — приглушённые и с
            меткой: пустой список не показывает, чего лишается пользователь. */}
        {sources.map((s) => (
          <SelectItem
            key={s.slug}
            value={s.slug}
            disabled={s.locked}
            className={`gap-2 py-2 ${s.locked ? "opacity-50" : ""}`}
          >
            <SourceIcon slug={s.slug} title={s.title} className="size-7 text-[11px]" />
            {s.title}
            {s.locked && (
              <span className="ml-auto rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                {tb("pro")}
              </span>
            )}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function TypeSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const t = useTranslations("prices");
  const td = withDynamicKeys(t);
  return (
    <Select
      value={value}
      onValueChange={(v) => onChange(v as string)}
      items={PRICE_TYPES.map((pt) => ({ label: td(`type.${pt.value}`), value: pt.value }))}
    >
      <SelectTrigger className="h-10 w-full min-w-0">
        <SelectValue />
      </SelectTrigger>
      <SelectContent
        alignItemWithTrigger={false}
        align="end"
        className="w-[22rem] max-w-[calc(100vw-2rem)] p-1"
      >
        {PRICE_TYPES.map((pt) => (
          <SelectItem key={pt.value} value={pt.value} disabled={!pt.field} className="py-1.5">
            {td(`type.${pt.value}`)}
            {!pt.field && (
              <span className="ml-auto rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                {t("unavailable")}
              </span>
            )}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * Поле диапазона. Значение хранится в URL, поэтому локальный ввод
 * синхронизируется с ним прямо в рендере — иначе после «Сбросить все фильтры»
 * или выбора шаблона в поле оставался бы старый текст.
 */
function RangeField({
  label,
  value,
  placeholder,
  unit,
  decimal = true,
  onCommit,
}: {
  label: string;
  value: string;
  placeholder: string;
  unit?: string;
  /** Количество — целое; цена — с копейками. */
  decimal?: boolean;
  onCommit: (v: string) => void;
}) {
  const [v, setV] = useState(value);
  const [fromUrl, setFromUrl] = useState(value);
  if (fromUrl !== value) {
    setFromUrl(value);
    setV(value);
  }
  return (
    <label className="grid min-w-0 gap-1 text-xs text-muted-foreground">
      {label}
      <span className="relative">
        <NumberInput
          className={`h-10 ${unit ? "pr-9" : ""}`}
          decimal={decimal}
          placeholder={placeholder}
          value={v}
          onChange={(e) => setV(e.target.value)}
          onBlur={() => v !== value && onCommit(v)}
          onKeyDown={(e) => e.key === "Enter" && onCommit(v)}
        />
        {unit && (
          <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-muted-foreground">
            {unit}
          </span>
        )}
      </span>
    </label>
  );
}

/** Секция стороны связки. У покупки и продажи набор параметров одинаковый. */
function SideSection({
  title,
  sourceLabel,
  side,
  filters,
  sources,
  go,
}: {
  title: string;
  sourceLabel: string;
  side: "buy" | "sell";
  filters: PriceFilters;
  sources: SourceOption[];
  go: Go;
}) {
  const t = useTranslations("prices");
  const buy = side === "buy";
  return (
    <section className="space-y-3">
      <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {title}
      </h3>
      <div className="grid grid-cols-2 gap-2">
        <label className="grid min-w-0 gap-1 text-xs text-muted-foreground">
          {sourceLabel}
          <SourceSelect
            value={buy ? filters.buy : filters.sell}
            sources={sources}
            onChange={(v) => go(buy ? { buy: v } : { sell: v })}
          />
        </label>
        <label className="grid min-w-0 gap-1 text-xs text-muted-foreground">
          {t("priceType")}
          <TypeSelect
            value={buy ? filters.buyType : filters.sellType}
            onChange={(v) =>
              go(
                buy
                  ? { buyType: v as PriceFilters["buyType"] }
                  : { sellType: v as PriceFilters["sellType"] },
              )
            }
          />
        </label>
        <RangeField
          label={t("minPrice")}
          value={buy ? filters.buyMinPrice : filters.sellMinPrice}
          placeholder="0"
          unit="$"
          onCommit={(v) => go(buy ? { buyMinPrice: v } : { sellMinPrice: v })}
        />
        <RangeField
          label={t("maxPrice")}
          value={buy ? filters.buyMaxPrice : filters.sellMaxPrice}
          placeholder="∞"
          unit="$"
          onCommit={(v) => go(buy ? { buyMaxPrice: v } : { sellMaxPrice: v })}
        />
        <RangeField
          label={t("minQty")}
          value={buy ? filters.buyMinQty : filters.sellMinQty}
          placeholder="0"
          unit={t("pcs")}
          decimal={false}
          onCommit={(v) => go(buy ? { buyMinQty: v } : { sellMinQty: v })}
        />
        <RangeField
          label={t("maxQty")}
          value={buy ? filters.buyMaxQty : filters.sellMaxQty}
          placeholder="∞"
          unit={t("pcs")}
          decimal={false}
          onCommit={(v) => go(buy ? { buyMaxQty: v } : { sellMaxQty: v })}
        />
      </div>
    </section>
  );
}

export function PricesSidebar({ filters, sources, profiles }: Props) {
  const t = useTranslations("prices");
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(true);
  const [naming, setNaming] = useState(false);
  const [saveState, save, saving] = useActionState(savePriceProfile, {});

  const go: Go = (overrides) => {
    router.replace(pathname + buildPriceQuery(filters, { ...overrides, page: 1 }), {
      scroll: false,
    });
  };

  // Активный шаблон определяется параметром profile в адресе, а НЕ совпадением
  // настроек: иначе первое же изменение фильтра выбрасывало бы из шаблона.
  const activeProfile = profiles.find((p) => p.id === filters.profile);
  // Строка настроек без самой ссылки на шаблон — её и храним в шаблоне.
  const currentQuery = profileQuery(filters);

  // Состояние шаблона на момент входа в него. Нужно, чтобы «сохранить как
  // новый шаблон» не уносило с собой правки: исходный шаблон возвращается к
  // тому, каким его выбрали, а правки достаются новому.
  const baseline = useRef<{ id: string; query: string } | null>(null);
  useEffect(() => {
    if (activeProfile && baseline.current?.id !== activeProfile.id) {
      baseline.current = { id: activeProfile.id, query: activeProfile.query };
    }
  }, [activeProfile]);

  // Пока шаблон выбран, правки фильтров дописываются в него.
  useEffect(() => {
    if (activeProfile && activeProfile.query !== currentQuery) {
      void updatePriceProfileQuery(activeProfile.id, currentQuery);
    }
  }, [activeProfile, currentQuery]);

  // Только что созданный шаблон сразу становится активным — но ровно один раз:
  // иначе переключение на «Default» тут же возвращало бы обратно в шаблон.
  const savedId = saveState.profileId;
  const switchedTo = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (savedId && switchedTo.current !== savedId && savedId !== filters.profile) {
      switchedTo.current = savedId;
      // Создан ДРУГОЙ шаблон, а не пересохранён текущий: возвращаем исходному
      // те настройки, с которыми в него вошли, — иначе оба шаблона окажутся
      // одинаковыми и переключение между ними ничего не меняет.
      const prev = baseline.current;
      if (prev && prev.id !== savedId && prev.query !== currentQuery) {
        void updatePriceProfileQuery(prev.id, prev.query);
      }
      baseline.current = { id: savedId, query: currentQuery };
      router.replace(pathname + buildPriceQuery(filters, { profile: savedId }), {
        scroll: false,
      });
    }
  }, [savedId, filters, currentQuery, pathname, router]);

  // Форма имени закрывается после успешного сохранения — правим состояние
  // в рендере, а не эффектом.
  const [closedFor, setClosedFor] = useState<string | undefined>(undefined);
  if (savedId && closedFor !== savedId) {
    setClosedFor(savedId);
    setNaming(false);
  }

  const pickProfile = (id: string) => {
    const p = profiles.find((x) => x.id === id);
    // «Default» — чистое состояние без шаблона.
    router.replace(p ? `${pathname}${p.query}${p.query ? "&" : "?"}profile=${p.id}` : pathname, {
      scroll: false,
    });
  };

  if (!open) {
    return (
      <aside className={`${STICKY} shrink-0 lg:w-14 lg:border-r lg:border-border lg:bg-card`}>
        <button
          onClick={() => setOpen(true)}
          className="flex size-10 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:text-foreground lg:mt-6 lg:ml-3"
          title={t("showSettings")}
        >
          <ChevronRight className="size-5" />
        </button>
      </aside>
    );
  }

  return (
    <aside className={`${STICKY} w-full shrink-0 lg:w-96 lg:border-r lg:border-border lg:bg-card`}>
      <div className="flex h-full flex-col rounded-lg border border-border bg-card lg:rounded-none lg:border-0">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3 lg:pl-8">
          <SlidersHorizontal className="size-5 text-primary" />
          <h2 className="flex-1 text-sm font-semibold">{t("tableSettings")}</h2>
          <button
            onClick={() => setOpen(false)}
            className="text-muted-foreground transition-colors hover:text-foreground"
            title={t("collapse")}
          >
            <ChevronLeft className="size-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 lg:pl-8">
          {/* Шаблон профиля: сохранённый набор настроек целиком */}
          <section className="space-y-2">
            <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {t("profileTemplate")}
            </h3>
            <div className="flex items-center gap-2">
              <Select
                value={activeProfile?.id ?? ""}
                onValueChange={(v) => pickProfile(v as string)}
                items={[
                  { label: "Default", value: "" },
                  ...profiles.map((p) => ({ label: p.name, value: p.id })),
                ]}
              >
                <SelectTrigger className="h-10 w-full min-w-0">
                  <SelectValue placeholder="Default" />
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false} className="max-h-72 p-1">
                  <SelectItem value="" className="py-1.5">
                    Default
                  </SelectItem>
                  {profiles.map((p) => (
                    <SelectItem key={p.id} value={p.id} className="py-1.5">
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <button
                type="button"
                onClick={() => setNaming((v) => !v)}
                title={t("saveAsTemplate")}
                className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-primary/60 hover:text-primary"
              >
                {naming ? <X className="size-5" /> : <Plus className="size-5" />}
              </button>
              {activeProfile && (
                <button
                  type="button"
                  title={t("deleteTemplate", { name: activeProfile.name })}
                  onClick={async () => {
                    await deletePriceProfile(activeProfile.id);
                    // Убираем ссылку на удалённый шаблон из адреса.
                    router.replace(pathname + buildPriceQuery(filters, { profile: "" }), {
                      scroll: false,
                    });
                  }}
                  className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-destructive/60 hover:text-destructive"
                >
                  <Trash2 className="size-5" />
                </button>
              )}
            </div>

            {naming && (
              <form action={save} className="flex items-center gap-2">
                <input type="hidden" name="query" value={currentQuery} />
                {/* Поле всегда пустое: «+» — это создание нового шаблона,
                    а не переименование текущего. */}
                <Input
                  name="name"
                  autoFocus
                  maxLength={40}
                  placeholder={t("templateName")}
                  className="h-10"
                />
                <Button type="submit" size="sm" disabled={saving} className="h-10 shrink-0">
                  {t("save")}
                </Button>
              </form>
            )}
            {saveState.error && <p className="text-xs text-destructive">{saveState.error}</p>}
            <p className="text-[11px] text-muted-foreground">
              {activeProfile
                ? t("templateActiveNote")
                : t("templateEmptyNote")}
            </p>
          </section>

          <SideSection
            title={t("buySite")}
            sourceLabel={t("buyFrom")}
            side="buy"
            filters={filters}
            sources={sources}
            go={go}
          />

          {/* Свап сторон целиком: площадки, типы цен и все диапазоны */}
          <div className="flex justify-center">
            <button
              onClick={() => go(swapSides(filters))}
              className="flex size-10 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:text-foreground"
              title={t("swap")}
            >
              <ArrowUpDown className="size-5" />
            </button>
          </div>

          <SideSection
            title={t("sellSite")}
            sourceLabel={t("sellTo")}
            side="sell"
            filters={filters}
            sources={sources}
            go={go}
          />
        </div>

        <div className="border-t border-border p-4 lg:pl-8">
          <Button
            variant="outline"
            className="w-full"
            onClick={() =>
              router.replace(
                filters.profile ? `${pathname}?profile=${filters.profile}` : pathname,
                { scroll: false },
              )
            }
          >
            {t("resetAll")}
          </Button>
        </div>
      </div>
    </aside>
  );
}
