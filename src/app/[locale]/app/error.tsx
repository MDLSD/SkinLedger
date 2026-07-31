"use client";

import { useEffect } from "react";
import { ErrorFallback } from "@/components/error-fallback";

/**
 * Граница ошибок раздела /app. Без неё необработанный бросок отдан дефолту
 * фреймворка. Рендерится внутри layout приложения (шапка остаётся).
 */
export default function AppError({
  error,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("app error boundary", error.digest ?? "no digest");
  }, [error]);

  return <ErrorFallback error={error} />;
}
