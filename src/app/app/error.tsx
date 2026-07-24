"use client";

import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Граница ошибок для всего раздела /app.
 *
 * Без неё поведение при необработанном броске отдано дефолту фреймворка:
 * в проде это страница Next с `digest`, в dev — полный текст ошибки Prisma
 * с именами моделей и полей. Утечки в проде и так нет, но пусть это будет
 * свойством кода, а не дефолта. Наружу — фиксированный текст; `digest`
 * (идентификатор для серверного лога) показываем, чтобы его можно было
 * назвать в поддержке, но без самого сообщения.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("app error boundary", error.digest ?? "no digest");
  }, [error]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-5 py-16 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary">
        <TriangleAlert className="size-7" />
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Что-то пошло не так</h1>
        <p className="text-muted-foreground">
          Не удалось загрузить страницу. Попробуйте повторить — если ошибка
          повторяется, сообщите нам код ниже.
        </p>
      </div>
      {error.digest && (
        <p className="font-mono text-xs text-muted-foreground">Код: {error.digest}</p>
      )}
      <Button onClick={reset}>Повторить</Button>
    </div>
  );
}
