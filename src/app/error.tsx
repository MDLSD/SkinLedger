"use client";

import { useEffect } from "react";
import { ErrorFallback } from "@/components/error-fallback";

// Граница ошибок для публичных маршрутов (лендинг, вход, регистрация).
export default function RootError({
  error,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("root error boundary", error.digest ?? "no digest");
  }, [error]);

  return (
    <main className="min-h-screen">
      <ErrorFallback error={error} />
    </main>
  );
}
