"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { useSkinsIndex } from "@/lib/skins-client";
import {
  indexFamilies,
  searchFamilies,
  skinThumb,
  type SkinFamily,
} from "@/lib/skin-search";

function familyLabel(f: SkinFamily): string {
  return f.label;
}

// Названия для анимации подсказки (печатаются и стираются по букве).
const PLACEHOLDER_SKINS = [
  "AK-47 | Redline",
  "AWP | Dragon Lore",
  "M4A4 | Howl",
  "AWP | Asiimov",
  "Glock-18 | Fade",
  "Desert Eagle | Blaze",
  "Karambit | Doppler",
  "AK-47 | Fire Serpent",
  "USP-S | Kill Confirmed",
  "M4A1-S | Hyper Beast",
];

// Подпись под названием: рус. алиас у скинов, тип у стикеров/агентов.
function familySubtitle(f: SkinFamily): string | null {
  if (f.kind === "sticker") return "Стикер";
  if (f.kind === "agent") return "Агент";
  return f.r && f.r !== f.s ? f.r : null;
}

type Props = {
  value: SkinFamily | null;
  onSelect: (family: SkinFamily) => void;
  autoFocus?: boolean;
};

export function SkinCombobox({ value, onSelect, autoFocus }: Props) {
  const families = useSkinsIndex();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  // Debounce ввода 200 мс.
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const id = setTimeout(() => setDebounced(query), 200);
    return () => clearTimeout(id);
  }, [query]);

  const indexed = useMemo(
    () => (families ? indexFamilies(families) : []),
    [families],
  );

  const results = useMemo(() => {
    if (!open || debounced.trim().length === 0) return [];
    return searchFamilies(indexed, debounced, 10);
  }, [indexed, debounced, open]);

  useEffect(() => setActive(0), [debounced]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  // Анимация подсказки: названия печатаются и стираются по букве; когда
  // строка пуста — «Поиск». Останавливается, когда поле в фокусе или выбрано
  // значение — тогда просто «Поиск».
  const [typed, setTyped] = useState("");
  const animate = !open && !value && families !== null;
  useEffect(() => {
    if (!animate) return;
    let cancelled = false;
    let nameIdx = 0;
    let charIdx = 0;
    let phase: "typing" | "pause" | "deleting" | "idle" = "typing";
    let timer: ReturnType<typeof setTimeout>;

    const tick = () => {
      if (cancelled) return;
      const name = PLACEHOLDER_SKINS[nameIdx];
      let delay = 80;
      if (phase === "typing") {
        charIdx += 1;
        setTyped(name.slice(0, charIdx));
        if (charIdx >= name.length) {
          phase = "pause";
          delay = 1300;
        } else delay = 60 + Math.random() * 70;
      } else if (phase === "pause") {
        phase = "deleting";
        delay = 400;
      } else if (phase === "deleting") {
        charIdx -= 1;
        setTyped(name.slice(0, Math.max(0, charIdx)));
        if (charIdx <= 0) {
          phase = "idle";
          setTyped("Поиск");
          delay = 1000;
        } else delay = 35;
      } else {
        nameIdx = (nameIdx + 1) % PLACEHOLDER_SKINS.length;
        charIdx = 0;
        phase = "typing";
        delay = 250;
      }
      timer = setTimeout(tick, delay);
    };

    timer = setTimeout(tick, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [animate]);

  const pick = (f: SkinFamily) => {
    onSelect(f);
    setQuery("");
    setOpen(false);
  };

  const displayValue = open ? query : value ? familyLabel(value) : query;
  const placeholder =
    families === null
      ? "Загрузка справочника…"
      : animate
        ? typed || "Поиск"
        : "Поиск";

  return (
    <div ref={boxRef} className="relative">
      <Input
        autoFocus={autoFocus}
        value={displayValue}
        placeholder={placeholder}
        disabled={families === null}
        onFocus={() => {
          setOpen(true);
          setQuery("");
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (!open) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, results.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter" && results[active]) {
            e.preventDefault();
            pick(results[active]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        aria-autocomplete="list"
        aria-expanded={open}
        role="combobox"
      />
      {open && results.length > 0 && (
        <ul className="absolute z-50 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border bg-popover p-1 shadow-md">
          {results.map((f, i) => (
            <li key={f.f}>
              <button
                type="button"
                className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm ${
                  i === active ? "bg-muted" : "hover:bg-muted"
                }`}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(f);
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={skinThumb(f.img)}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="h-8 w-12 shrink-0 rounded bg-muted object-contain"
                />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate">{familyLabel(f)}</span>
                  {familySubtitle(f) && (
                    <span className="truncate text-xs text-muted-foreground">
                      {familySubtitle(f)}
                    </span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && debounced.trim().length > 0 && results.length === 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border bg-popover px-3 py-2 text-sm text-muted-foreground shadow-md">
          Ничего не найдено
        </div>
      )}
    </div>
  );
}
