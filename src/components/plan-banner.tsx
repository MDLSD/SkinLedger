import { Lock } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Plan, PlanLimits } from "@/lib/plan";

/**
 * Полоса про ограничения бесплатного тарифа над инструментом (ТЗ 6).
 * У pro не показывается вовсе: платящему незачем видеть, что он платит.
 */
export async function PlanBanner({
  plan,
  limits,
  hiddenSources,
}: {
  plan: Plan;
  limits: PlanLimits;
  hiddenSources: number;
}) {
  if (plan === "pro") return null;
  const t = await getTranslations("billing");

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2 text-xs">
      <Lock className="size-4 shrink-0 text-destructive" />
      <span>
        {t("bannerLimits", {
          price: limits.maxItemPrice ?? 0,
          sources: limits.maxSources ?? 0,
        })}
        {hiddenSources > 0 && ` ${t("bannerHiddenSources", { count: hiddenSources })}`}
      </span>
      <Link href="/app/billing" className="ml-auto font-medium text-destructive hover:underline">
        {t("bannerCta")}
      </Link>
    </div>
  );
}
