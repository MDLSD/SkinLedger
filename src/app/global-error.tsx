"use client";

import { useEffect } from "react";

/**
 * Последняя линия обороны: срабатывает при ошибке в самом корневом layout,
 * поэтому заменяет его целиком и рендерит свои <html>/<body>. На стили
 * приложения полагаться нельзя — используем инлайн (палитра как в тёмной теме).
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("global error boundary", error.digest ?? "no digest");
  }, [error]);

  return (
    <html lang="ru">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "20px",
          padding: "24px",
          textAlign: "center",
          background: "#101319",
          color: "#e5edff",
          fontFamily:
            "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 16,
            border: "1px solid rgba(88,226,176,0.25)",
            background: "rgba(88,226,176,0.1)",
            color: "#58e2b0",
            fontSize: 26,
          }}
        >
          ⚠
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600 }}>
            Что-то пошло не так
          </h1>
          <p
            style={{
              margin: "8px auto 0",
              maxWidth: 360,
              color: "#92a1bf",
              fontSize: 15,
              lineHeight: 1.5,
            }}
          >
            Произошла непредвиденная ошибка. Попробуйте перезагрузить страницу —
            если повторится, сообщите код ниже.
          </p>
        </div>
        {error.digest && (
          <p style={{ margin: 0, fontFamily: "monospace", fontSize: 12, color: "#92a1bf" }}>
            Код: {error.digest}
          </p>
        )}
        <button
          onClick={reset}
          style={{
            height: 44,
            padding: "0 24px",
            borderRadius: 12,
            border: "none",
            background: "#58e2b0",
            color: "#101319",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Повторить
        </button>
      </body>
    </html>
  );
}
