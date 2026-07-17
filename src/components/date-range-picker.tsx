"use client";

import { useState } from "react";
import type { DateRange } from "react-day-picker";
import { ru } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

// --- Дата ↔ строки ---
function fromISO(s: string): Date | undefined {
  if (!s) return undefined;
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
}
function toISO(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function toRu(d: Date | undefined): string {
  if (!d) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
}
// Разбор ручного ввода дд.мм.гггг (или дд.мм.гг).
function parseRu(s: string): Date | undefined {
  const m = s.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/);
  if (!m) return undefined;
  const d = +m[1];
  const mo = +m[2];
  const y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return undefined;
  const date = new Date(y, mo - 1, d);
  return date.getMonth() === mo - 1 ? date : undefined; // отсечь 31.02 и т.п.
}

type Props = {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
};

export function DateRangePicker({ from, to, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [range, setRange] = useState<DateRange | undefined>({
    from: fromISO(from),
    to: fromISO(to),
  });
  const [month, setMonth] = useState<Date>(fromISO(from) ?? new Date());
  // Сырые строки полей (чтобы можно было печатать частично).
  const [fromText, setFromText] = useState(toRu(fromISO(from)));
  const [toText, setToText] = useState(toRu(fromISO(to)));

  const reset = () => {
    const f = fromISO(from);
    const t = fromISO(to);
    setRange({ from: f, to: t });
    setMonth(f ?? new Date());
    setFromText(toRu(f));
    setToText(toRu(t));
  };
  const onOpenChange = (o: boolean) => {
    if (o) reset();
    setOpen(o);
  };

  // Выбор на календаре → обновляем поля.
  const onSelect = (r: DateRange | undefined) => {
    setRange(r);
    setFromText(toRu(r?.from));
    setToText(toRu(r?.to));
  };
  // Ручной ввод → обновляем диапазон и прыгаем на месяц введённой даты.
  const onText = (key: "from" | "to") => (v: string) => {
    if (key === "from") setFromText(v);
    else setToText(v);
    const d = parseRu(v);
    if (!d) return;
    setRange((r) =>
      key === "from" ? { from: d, to: r?.to } : { from: r?.from, to: d },
    );
    setMonth(d);
  };

  const label =
    fromISO(from) && fromISO(to)
      ? `${toRu(fromISO(from))} – ${toRu(fromISO(to))}`
      : "Выберите даты";

  const apply = () => {
    if (!range?.from) return;
    let a = range.from;
    let z = range.to ?? range.from;
    if (a > z) [a, z] = [z, a];
    onChange(toISO(a), toISO(z));
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-56 justify-start font-normal"
          />
        }
      >
        <CalendarIcon className="size-4 text-muted-foreground" />
        <span className={fromISO(from) ? "" : "text-muted-foreground"}>
          {label}
        </span>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="start">
        <Calendar
          mode="range"
          selected={range}
          onSelect={onSelect}
          numberOfMonths={1}
          month={month}
          onMonthChange={setMonth}
          locale={ru}
          autoFocus
        />
        <div className="mt-3 flex items-center gap-2 border-t pt-3">
          <Input
            aria-label="Дата начала"
            placeholder="дд.мм.гггг"
            className="h-8 w-32 text-center"
            value={fromText}
            onChange={(e) => onText("from")(e.target.value)}
          />
          <span className="text-muted-foreground">–</span>
          <Input
            aria-label="Дата конца"
            placeholder="дд.мм.гггг"
            className="h-8 w-32 text-center"
            value={toText}
            onChange={(e) => onText("to")(e.target.value)}
          />
          <Button size="sm" className="ml-auto" onClick={apply} disabled={!range?.from}>
            Применить
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
