"use client";

import { useEffect } from "react";
import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Граница ошибок для публичных маршрутов (лендинг, вход, регистрация).
 * Наружу — фиксированный текст; digest (id серверного лога) показываем для
 * поддержки, без самого сообщения.
 */
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("root error boundary", error.digest ?? "no digest");
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-5 p-6 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary">
        <TriangleAlert className="size-7" />
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Что-то пошло не так</h1>
        <p className="max-w-sm text-muted-foreground">
          Произошла непредвиденная ошибка. Попробуйте обновить страницу — если
          повторится, сообщите код ниже.
        </p>
      </div>
      {error.digest && (
        <p className="font-mono text-xs text-muted-foreground">Код: {error.digest}</p>
      )}
      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={reset}>Повторить</Button>
        <Button variant="outline" nativeButton={false} render={<Link href="/" />}>
          На главную
        </Button>
      </div>
    </main>
  );
}
