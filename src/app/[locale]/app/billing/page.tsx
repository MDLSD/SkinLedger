import type { Metadata } from "next";
import { Check, Lock } from "lucide-react";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { redirect } from "@/i18n/navigation";
import { toLocale } from "@/i18n/routing";
import { prisma } from "@/lib/prisma";
import { ProRequestButton } from "@/components/pro-request-button";
import { effectivePlan, PLAN_LIMITS } from "@/lib/plan";

type Params = Promise<{ locale: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: toLocale(locale), namespace: "billing" });
  return { title: t("metaTitle") };
}

export default async function BillingPage({ params }: { params: Params }) {
  const { locale: rawLocale } = await params;
  const locale = toLocale(rawLocale);
  setRequestLocale(locale);
  const t = await getTranslations("billing");
  const format = await getFormatter();

  const session = await auth();
  if (!session?.user?.id) redirect({ href: "/login", locale });

  const [user, request] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { plan: true, planUntil: true, email: true },
    }),
    prisma.lead.findFirst({
      where: { email: session.user.email ?? "", feature: "pro" },
      select: { id: true },
    }),
  ]);

  const plan = effectivePlan(user);
  const free = PLAN_LIMITS.free;

  // Три платные функции, все на странице «Таблица»: цена без потолка,
  // все площадки и графики по клику на цену. Бесплатная карточка перечисляет
  // те же три пункта в урезанном виде — так видно, за что именно платят.
  const freeFeatures = [
    t("featurePublic"),
    t("featurePrice", { price: free.maxItemPrice ?? 0 }),
    t("featureSources", { count: free.maxSources ?? 0 }),
    t("featureNoCharts"),
  ];
  const proFeatures = [
    t("featurePublic"),
    t("featurePriceAll"),
    t("featureSourcesAll"),
    t("featureCharts"),
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <div className="text-xs text-muted-foreground">{t("current")}</div>
        <div className="mt-1 flex flex-wrap items-baseline gap-2">
          <span className="text-lg font-semibold">
            {plan === "pro" ? t("pro") : t("free")}
          </span>
          {plan === "pro" && (
            <span className="text-xs text-muted-foreground">
              {user?.planUntil
                ? t("until", { date: format.dateTime(user.planUntil, { dateStyle: "long" }) })
                : t("unlimited")}
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {plan === "pro" ? t("yourPlanPro") : t("yourPlanFree")}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <PlanCard
          title={t("free")}
          features={freeFeatures}
          active={plan === "free"}
          activeLabel={t("current")}
        />
        <PlanCard
          title={t("pro")}
          features={proFeatures}
          highlighted
          active={plan === "pro"}
          activeLabel={t("current")}
          footer={
            plan === "pro" ? null : (
              <div className="space-y-2">
                <ProRequestButton alreadySent={Boolean(request)} />
                <p className="text-xs text-muted-foreground">{t("paymentsSoon")}</p>
              </div>
            )
          }
        />
      </div>
    </div>
  );
}

function PlanCard({
  title,
  features,
  footer,
  highlighted,
  active,
  activeLabel,
}: {
  title: string;
  features: string[];
  footer?: React.ReactNode;
  highlighted?: boolean;
  active: boolean;
  activeLabel: string;
}) {
  return (
    <section
      className={`flex flex-col gap-3 rounded-lg border p-4 ${
        highlighted ? "border-primary/50 bg-primary/5" : "border-border bg-card"
      }`}
    >
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        {active && (
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
            {activeLabel}
          </span>
        )}
      </div>
      <ul className="space-y-1.5 text-sm">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2">
            {highlighted ? (
              <Check className="mt-0.5 size-4 shrink-0 text-primary" />
            ) : (
              <Lock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            )}
            <span>{f}</span>
          </li>
        ))}
      </ul>
      {footer && <div className="mt-auto pt-2">{footer}</div>}
    </section>
  );
}
