"use client";

import { useEffect } from "react";
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
    <div className="mx-auto max-w-md space-y-4 py-16 text-center">
      <h1 className="text-xl font-semibold">Что-то пошло не так</h1>
      <p className="text-sm text-muted-foreground">
        Не удалось загрузить страницу. Попробуйте повторить — если ошибка
        повторяется, сообщите нам код ниже.
      </p>
      {error.digest && (
        <p className="font-mono text-xs text-muted-foreground">
          Код: {error.digest}
        </p>
      )}
      <Button onClick={reset}>Повторить</Button>
    </div>
  );
}
