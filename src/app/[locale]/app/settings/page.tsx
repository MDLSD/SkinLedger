import type { Metadata } from "next";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { redirect } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import { getRates } from "@/lib/rates";
import { CURRENCY_SYMBOL, fxFactor } from "@/lib/currency";
import { CurrencySettings } from "@/components/currency-settings";
import { GoalSettings } from "@/components/goal-settings";
import { PasswordSettings } from "@/components/password-settings";
import { PlatformSettings } from "@/components/platform-settings";
import { DeleteAccount } from "@/components/delete-account";
import { CURRENCIES } from "@/lib/validation";
import { toLocale } from "@/i18n/routing";

// Именованные форматы next-intl требуют объявления в конфиге; без него
// format.dateTime(d, "short") отдаёт сырой Date.toString(). Задаём явно.
const DATE_TIME = {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
} as const;

type Params = Promise<{ locale: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = toLocale(rawLocale);
  const t = await getTranslations({ locale, namespace: "meta" });
  return { title: t("settings") };
}

export default async function SettingsPage({ params }: { params: Params }) {
  const { locale: rawLocale } = await params;
  const locale = toLocale(rawLocale);
  setRequestLocale(locale);
  const t = await getTranslations("settings");
  const format = await getFormatter();

  const session = await auth();
  if (!session?.user?.id) redirect({ href: "/login", locale });

  const [user, { rates, updatedAt, source }, platformRows] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: session.user.id },
      // Только нужное поле: без select сюда приезжал и passwordHash.
      select: { baseCurrency: true, monthlyGoal: true },
    }),
    getRates(),
    prisma.platform.findMany({
      where: { OR: [{ isCustom: false }, { userId: session.user.id }] },
      orderBy: [{ isCustom: "asc" }, { name: "asc" }],
    }),
  ]);
  const base = user.baseCurrency;

  const customPlatforms = platformRows
    .filter((p) => p.isCustom)
    .map((p) => ({
      id: p.id,
      name: p.name,
      buyFee: Number(p.defaultBuyFeePct),
      sellFee: Number(p.defaultSellFeePct),
    }));
  const seededPlatforms = platformRows
    .filter((p) => !p.isCustom)
    .map((p) => ({
      name: p.name,
      buyFee: Number(p.defaultBuyFeePct),
      sellFee: Number(p.defaultSellFeePct),
    }));

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>

      <section className="rounded-lg border bg-card p-4">
        <h2 className="text-sm font-medium">{t("currency")}</h2>
        <p className="mt-1 mb-3 text-sm text-muted-foreground">
          {t("currencyNote")}
        </p>
        <CurrencySettings current={base} />
      </section>

      <section className="rounded-lg border bg-card p-4">
        <h2 className="text-sm font-medium">{t("goal")}</h2>
        <p className="mt-1 mb-3 text-sm text-muted-foreground">
          {t("goalNote")}
        </p>
        <GoalSettings current={user.monthlyGoal == null ? null : Number(user.monthlyGoal)} currency={base} />
      </section>

      <section className="rounded-lg border bg-card p-4">
        <h2 className="text-sm font-medium">{t("password")}</h2>
        <p className="mt-1 mb-3 text-sm text-muted-foreground">
          {t("passwordNote")}
        </p>
        <PasswordSettings />
      </section>

      <section className="rounded-lg border bg-card p-4">
        <h2 className="text-sm font-medium">{t("platforms")}</h2>
        <p className="mt-1 mb-3 text-sm text-muted-foreground">
          {t("platformsNote")}
        </p>
        <PlatformSettings custom={customPlatforms} seeded={seededPlatforms} />
      </section>

      <section className="rounded-lg border bg-card p-4">
        <h2 className="mb-1 text-sm font-medium">
          {t("ratesTo", { currency: `${base} ${CURRENCY_SYMBOL[base] ?? ""}` })}
        </h2>
        <p className="mb-3 text-xs text-muted-foreground">
          {source === "live"
            ? t("ratesUpdated", { at: format.dateTime(new Date(updatedAt), DATE_TIME) })
            : source === "cache"
              ? t("ratesStale", { at: format.dateTime(new Date(updatedAt), DATE_TIME) })
              : t("ratesFallback")}
        </p>
        <table className="text-sm">
          <tbody>
            {CURRENCIES.filter((c) => c !== base)
              .map((c) => (
                <tr key={c}>
                  <td className="py-1 pr-6">
                    1 {c} {CURRENCY_SYMBOL[c] ?? ""}
                  </td>
                  <td className="py-1 font-medium">
                    {fxFactor(c, base, rates)?.toLocaleString(locale, {
                      maximumFractionDigits: 3,
                    }) ?? "—"}{" "}
                    {CURRENCY_SYMBOL[base] ?? base}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </section>

      <section className="rounded-lg border border-destructive/30 p-4">
        <h2 className="text-sm font-medium text-destructive">{t("deleteAccount")}</h2>
        <p className="mt-1 mb-3 text-sm text-muted-foreground">
          {t("deleteAccountNote")}
        </p>
        <DeleteAccount />
      </section>
    </div>
  );
}
