"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search } from "lucide-react";
import { formatMoney } from "@/lib/deal-math";
import { useTypedPlaceholder } from "@/components/use-typed-placeholder";

type Hit = {
  slug: string;
  title: string;
  weapon: string | null;
  image: string | null;
  low: number | null;
  high: number | null;
  variants: number;
};

const MIN_QUERY = 2;

/**
 * Поиск по каталогу в шапке: подсказки с картинкой и ценой, переход на
 * страницу предмета. Запрос уходит на публичный /api/search с задержкой,
 * чтобы не дёргать базу на каждое нажатие.
 */
export function SkinSearchBox({ className = "" }: { className?: string }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  // Результат храним вместе с запросом, под который он получен: тогда
  // «идёт загрузка» и «список пуст» выводятся из состояния, а не ставятся
  // синхронно в эффекте.
  const [result, setResult] = useState<{ q: string; hits: Hit[] }>({ q: "", hits: [] });
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const box = useRef<HTMLDivElement>(null);

  const query = q.trim();
  const ready = result.q === query;
  const hits = ready ? result.hits : [];
  const loading = query.length >= MIN_QUERY && !ready;
  const activeIdx = hits.length ? Math.min(active, hits.length - 1) : 0;
  // Та же анимация подсказки, что в форме сделки: названия печатаются и
  // стираются, пока поле пустое и не в фокусе.
  const placeholder = useTypedPlaceholder(!open && q === "");

  // Клик мимо — закрываем список.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  useEffect(() => {
    if (query.length < MIN_QUERY) return;
    let alive = true;
    const timer = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(query)}`)
        .then((r) => (r.ok ? r.json() : { hits: [] }))
        .then((d: { hits?: Hit[] }) => alive && setResult({ q: query, hits: d.hits ?? [] }))
        .catch(() => alive && setResult({ q: query, hits: [] }));
    }, 250);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [query]);

  const go = (hit: Hit) => {
    setOpen(false);
    setQ("");
    router.push(`/skins/${hit.slug}`);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (!open || !hits.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % hits.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i - 1 + hits.length) % hits.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(hits[activeIdx]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={box} className={`relative ${className}`}>
      <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground">
        {loading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
      </span>
      <input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKey}
        placeholder={placeholder}
        aria-label="Поиск скина"
        className="h-9 w-full rounded-lg border border-border bg-card pr-3 pl-9 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/60"
      />

      {open && query.length >= MIN_QUERY && (
        <div className="absolute top-full right-0 left-0 z-50 mt-1 overflow-hidden rounded-lg border border-border bg-popover shadow-lg">
          {hits.length === 0 ? (
            <p className="px-3 py-3 text-xs text-muted-foreground">
              {loading ? "Ищем…" : "Ничего не нашли"}
            </p>
          ) : (
            <ul className="max-h-96 overflow-y-auto py-1">
              {hits.map((h, i) => (
                <li key={h.slug}>
                  <button
                    type="button"
                    onMouseEnter={() => setActive(i)}
                    onClick={() => go(h)}
                    className={`flex w-full items-center gap-3 px-3 py-2 text-left transition-colors ${
                      i === activeIdx ? "bg-muted/60" : ""
                    }`}
                  >
                    {h.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={h.image}
                        alt=""
                        className="h-10 w-14 shrink-0 rounded bg-muted/40 object-contain"
                        loading="lazy"
                      />
                    ) : (
                      <span className="block h-10 w-14 shrink-0 rounded bg-muted/40" />
                    )}
                    <span className="min-w-0 flex-1">
                      {h.weapon && (
                        <span className="block text-[10px] text-muted-foreground">{h.weapon}</span>
                      )}
                      <span className="block truncate text-sm">{h.title}</span>
                      <span className="block truncate text-xs tabular-nums text-primary">
                        {h.low == null
                          ? "нет цен"
                          : h.high != null && h.high !== h.low
                            ? `${formatMoney(h.low, "USD")} — ${formatMoney(h.high, "USD")}`
                            : formatMoney(h.low, "USD")}
                      </span>
                    </span>
                    {h.variants > 1 && (
                      <span className="shrink-0 text-[10px] text-muted-foreground">
                        {h.variants} вар.
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
