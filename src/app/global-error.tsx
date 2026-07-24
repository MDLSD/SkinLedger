"use client";

import { useEffect } from "react";

/**
 * Последняя линия обороны: срабатывает при ошибке в самом корневом layout,
 * поэтому заменяет его целиком и рендерит свои <html>/<body>. На стили
 * приложения полагаться нельзя — используем инлайн (палитра тёмной темы).
 */
export default function GlobalError({
  error,
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
            width: 64,
            height: 64,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 16,
            border: "1px solid rgba(255,87,87,0.3)",
            background: "rgba(255,87,87,0.1)",
            color: "#ff5757",
            fontSize: 30,
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
            Произошла непредвиденная ошибка. Попробуйте перезагрузить страницу.
          </p>
        </div>
        {(error.message || error.digest) && (
          <div
            style={{
              width: "100%",
              maxWidth: 420,
              textAlign: "left",
              borderRadius: 10,
              border: "1px solid #2a3142",
              background: "rgba(27,31,40,0.6)",
              padding: 12,
              fontSize: 12,
            }}
          >
            {error.message && (
              <p style={{ margin: 0, wordBreak: "break-word" }}>
                <span style={{ color: "#92a1bf" }}>Код ошибки: </span>
                <span style={{ fontFamily: "monospace", color: "#ff5757" }}>
                  {error.message}
                </span>
              </p>
            )}
            {error.digest && (
              <p style={{ margin: "4px 0 0", color: "#92a1bf", wordBreak: "break-all" }}>
                ID: <span style={{ fontFamily: "monospace" }}>{error.digest}</span>
              </p>
            )}
          </div>
        )}
        <button
          onClick={() => window.location.reload()}
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
          Перезагрузить
        </button>
        <p style={{ margin: 0, fontSize: 12, color: "#92a1bf" }}>
          Если проблема повторяется, обратитесь в поддержку.
        </p>
      </body>
    </html>
  );
}
