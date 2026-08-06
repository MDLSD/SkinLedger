"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requestProAction } from "@/lib/actions/billing";

/** Кнопка заявки на Pro: оплаты пока нет, копим спрос. */
export function ProRequestButton({ alreadySent }: { alreadySent: boolean }) {
  const t = useTranslations("billing");
  const [sent, setSent] = useState(alreadySent);
  const [pending, startTransition] = useTransition();

  if (sent) {
    return (
      <p className="flex items-center gap-2 text-sm text-primary">
        <Check className="size-4" />
        {t("ctaSent")}
      </p>
    );
  }

  return (
    <Button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await requestProAction();
          if (res.success) setSent(true);
        })
      }
    >
      {t("ctaRequest")}
    </Button>
  );
}
