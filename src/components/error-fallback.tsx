"use client";

import { useState } from "react";
import { Check, Copy, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Единый вид заглушки ошибки (для error.tsx корня и /app). Наружу показываем
 * сообщение об ошибке и digest: в проде Next санитизирует серверные ошибки
 * (остаётся только digest), клиентские (напр. загрузка чанка) — безопасны.
 */
export function ErrorFallback({
  error,
}: {
  error: Error & { digest?: string };
}) {
  const [copied, setCopied] = useState(false);
  const details = [
    error.message && `Ошибка: ${error.message}`,
    error.digest && `ID: ${error.digest}`,
  ]
    .filter(Boolean)
    .join("\n");

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(details);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard недоступен — молча игнорируем */
    }
  };

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-5 px-6 py-16 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl border border-destructive/30 bg-destructive/10 text-destructive">
        <TriangleAlert className="size-8" />
      </div>

      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Что-то пошло не так</h1>
        <p className="max-w-sm text-muted-foreground">
          Произошла непредвиденная ошибка. Попробуйте перезагрузить страницу.
        </p>
      </div>

      {details && (
        <div className="w-full max-w-md rounded-lg border bg-card/60 p-3 text-left">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 space-y-1 text-xs">
              {error.message && (
                <p className="break-words">
                  <span className="text-muted-foreground">Код ошибки: </span>
                  <span className="font-mono text-destructive">{error.message}</span>
                </p>
              )}
              {error.digest && (
                <p className="break-all text-muted-foreground">
                  ID: <span className="font-mono">{error.digest}</span>
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={copy}
              title="Скопировать"
              aria-label="Скопировать детали ошибки"
              className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {copied ? (
                <Check className="size-4 text-emerald-400" />
              ) : (
                <Copy className="size-4" />
              )}
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={() => window.location.reload()}>Перезагрузить</Button>
        <Button variant="outline" onClick={copy}>
          {copied ? "Скопировано" : "Сообщить"}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Если проблема повторяется, обратитесь в поддержку.
      </p>
    </div>
  );
}
