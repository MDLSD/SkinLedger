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
  // Отображаемый месяц (чтобы календарь прыгал при ручном вводе даты).
  const [month, setMonth] = useState<Date>(parse(from) ?? new Date());

  const onOpenChange = (o: boolean) => {
    if (o) {
      setRange({ from: parse(from), to: parse(to) });
      setMonth(parse(from) ?? new Date());
    }
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
    if (!range?.from) return;
    let a = range.from;
    let z = range.to ?? range.from;
    if (a > z) [a, z] = [z, a]; // на случай from > to при ручном вводе
    onChange(fmtISO(a), fmtISO(z));
    setOpen(false);
  };

  const onInput = (key: "from" | "to") => (v: string) => {
    const d = parse(v);
    setRange((r) =>
      key === "from" ? { from: d, to: r?.to } : { from: r?.from, to: d },
    );
    if (d) setMonth(d);
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
          numberOfMonths={1}
          month={month}
          onMonthChange={setMonth}
          locale={ru}
          autoFocus
        />
        <div className="flex flex-wrap items-center gap-2 border-t p-3">
          <Input
            type="date"
            aria-label="Дата начала"
            className="h-8 w-[140px]"
            value={range?.from ? fmtISO(range.from) : ""}
            onChange={(e) => onInput("from")(e.target.value)}
          />
          <span className="text-muted-foreground">–</span>
          <Input
            type="date"
            aria-label="Дата конца"
            className="h-8 w-[140px]"
            value={range?.to ? fmtISO(range.to) : ""}
            onChange={(e) => onInput("to")(e.target.value)}
          />
          <Button
            size="sm"
            onClick={apply}
            disabled={!range?.from}
            className="ml-auto"
          >
            Применить
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
