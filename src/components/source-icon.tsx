import { cn } from "@/lib/utils";

// Логотипов площадок у нас нет, поэтому рисуем монограмму в фирменном цвете —
// этого достаточно, чтобы отличать площадки в списках и в шапке таблицы.
const STYLE: Record<string, { bg: string; fg: string; short: string }> = {
  steam: { bg: "#1b2838", fg: "#66c0f4", short: "St" },
  buff163: { bg: "#2a1e14", fg: "#f0a020", short: "Bu" },
  market_csgo: { bg: "#122436", fg: "#4ea8de", short: "Ma" },
  cs_money: { bg: "#2b2411", fg: "#f4b942", short: "CS" },
  skinport: { bg: "#2b1408", fg: "#fa6a1a", short: "Sk" },
  dmarket: { bg: "#1d1a33", fg: "#8b7dff", short: "DM" },
  lis_skins: { bg: "#2c1418", fg: "#f25f5c", short: "Li" },
  bitskins: { bg: "#0f2a22", fg: "#00d29a", short: "Bi" },
};

const FALLBACK = { bg: "#1f2937", fg: "#9ca3af" };

function short(slug: string, title?: string) {
  const src = (title ?? slug).replace(/[^A-Za-zА-Яа-я0-9]/g, "");
  return (src.slice(0, 2) || "??").replace(/^./, (c) => c.toUpperCase());
}

export function SourceIcon({
  slug,
  title,
  className,
}: {
  slug: string;
  title?: string;
  className?: string;
}) {
  const s = STYLE[slug];
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-5 shrink-0 items-center justify-center rounded text-[9px] font-bold tracking-tight",
        className,
      )}
      style={{ background: s?.bg ?? FALLBACK.bg, color: s?.fg ?? FALLBACK.fg }}
    >
      {s?.short ?? short(slug, title)}
    </span>
  );
}
