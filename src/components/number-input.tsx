"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";

/**
 * Числовое поле: буквы и прочий мусор в него просто не попадают — ни с
 * клавиатуры, ни вставкой, ни перетаскиванием. Нативный type="number" для
 * этого не годится: он пропускает «e», «+» и «-» в середине, а на вставку
 * нечислового текста молча обнуляет значение.
 *
 * Запятая приводится к точке: сервер разбирает значения через Number(), а
 * «1,5» дало бы NaN.
 */
export function sanitizeNumeric(
  raw: string,
  { decimal = true, negative = false }: { decimal?: boolean; negative?: boolean } = {},
): string {
  const neg = negative && raw.trimStart().startsWith("-");
  let s = raw.replace(/,/g, ".").replace(/[^\d.]/g, "");
  if (decimal) {
    // Разделитель оставляем только первый: «1.2.3» → «1.23».
    const i = s.indexOf(".");
    if (i >= 0) s = s.slice(0, i + 1) + s.slice(i + 1).replace(/\./g, "");
  } else {
    s = s.replace(/\./g, "");
  }
  return neg ? `-${s}` : s;
}

type Props = Omit<React.ComponentProps<typeof Input>, "type" | "inputMode"> & {
  /** Разрешить дробную часть. false — только целые (количество, штуки). */
  decimal?: boolean;
  /** Разрешить минус. По умолчанию отрицательных значений нет. */
  negative?: boolean;
};

export function NumberInput({ decimal = true, negative = false, onChange, ...props }: Props) {
  return (
    <Input
      {...props}
      type="text"
      inputMode={decimal ? "decimal" : "numeric"}
      onChange={(e) => {
        const clean = sanitizeNumeric(e.target.value, { decimal, negative });
        // Присваивание нужно неуправляемым полям: у управляемых значение
        // всё равно придёт из состояния родителя, уже очищенным.
        if (clean !== e.target.value) e.target.value = clean;
        onChange?.(e);
      }}
    />
  );
}
