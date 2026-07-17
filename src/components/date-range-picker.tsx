"use client";

import { useState } from "react";
import type { DateRange } from "react-day-picker";
import { ru } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

// yyyy-MM-dd → локальная дата (без сдвига часового пояса).
function parse(s: string): Date | undefined {
  if (!s) return undefined;
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
}
function fmtISO(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function fmtRu(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
}

type Props = {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
};

export function DateRangePicker({ from, to, onChange }: Props) {
  const [open, setOpen] = useState(false);
  // Локальный выбор; применяется только по кнопке. Пока календарь закрыт,
  // подпись отражает применённый фильтр (props), при открытии — живой выбор.
  const [range, setRange] = useState<DateRange | undefined>({
    from: parse(from),
    to: parse(to),
  });

  const onOpenChange = (o: boolean) => {
    if (o) setRange({ from: parse(from), to: parse(to) });
    setOpen(o);
  };

  const shown = open ? range : { from: parse(from), to: parse(to) };
  const label =
    shown?.from && shown?.to
      ? `${fmtRu(shown.from)} – ${fmtRu(shown.to)}`
      : shown?.from
        ? fmtRu(shown.from)
        : "Выберите даты";

  const apply = () => {
    if (range?.from) {
      onChange(fmtISO(range.from), fmtISO(range.to ?? range.from));
      setOpen(false);
    }
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
        <span className={shown?.from ? "" : "text-muted-foreground"}>
          {label}
        </span>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          selected={range}
          onSelect={setRange}
          numberOfMonths={2}
          defaultMonth={range?.from ?? new Date()}
          locale={ru}
          autoFocus
        />
        <div className="flex items-center justify-between gap-2 border-t p-3">
          <span className="text-sm text-muted-foreground">
            {range?.from && range?.to
              ? `${fmtRu(range.from)} – ${fmtRu(range.to)}`
              : range?.from
                ? "Выберите конец периода"
                : "Выберите начало периода"}
          </span>
          <Button size="sm" onClick={apply} disabled={!range?.from}>
            Применить
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
