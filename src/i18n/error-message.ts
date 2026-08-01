"use client";

import { useTranslations } from "next-intl";
import { withDynamicKeys } from "@/i18n/dynamic";

/**
 * Переводит ключ ошибки из схем валидации и серверных экшенов.
 *
 * Ключом сообщение бывает не всегда: zod на полях без своего message выдаёт
 * собственный текст («Too big: expected string…»), и такую строку показываем
 * как есть. Отсюда проверка `has` — без неё next-intl вернул бы на ней
 * заглушку вида `errors.Too big…` вместо самого сообщения.
 */
export type ErrorValues = Record<string, string | number>;

export function useErrorMessage(): (
  message?: string | null,
  values?: ErrorValues,
) => string | null {
  // Ключ приезжает из схемы или экшена обычной строкой.
  const t = withDynamicKeys(useTranslations("errors"));
  return (message, values) => {
    if (!message) return null;
    return t.has(message) ? t(message, values) : message;
  };
}
