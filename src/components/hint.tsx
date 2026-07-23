import { HelpCircle } from "lucide-react";

// Подсказка: значок «?» рядом с названием метрики; при наведении или фокусе
// с клавиатуры показывает пояснение. Чистый CSS (group-hover), без JS.
export function Hint({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex align-middle">
      <HelpCircle
        className="size-3.5 cursor-help text-muted-foreground/60 transition-colors hover:text-foreground"
        tabIndex={0}
        role="img"
        aria-label={text}
      />
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-1.5 w-56 max-w-[70vw] -translate-x-1/2 rounded-md border bg-popover px-2.5 py-1.5 text-xs font-normal leading-snug text-foreground opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {text}
      </span>
    </span>
  );
}
