import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { redirect } from "@/i18n/navigation";
import { ImportDeals } from "@/components/import-deals";
import { toLocale } from "@/i18n/routing";

type Params = Promise<{ locale: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = toLocale(rawLocale);
  const t = await getTranslations({ locale, namespace: "meta" });
  return { title: t("import") };
}

export default async function ImportPage({ params }: { params: Params }) {
  const { locale: rawLocale } = await params;
  const locale = toLocale(rawLocale);
  setRequestLocale(locale);
  const t = await getTranslations("importPage");

  const session = await auth();
  if (!session?.user?.id) redirect({ href: "/login", locale });

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>

      <section className="space-y-3 rounded-lg border p-4 text-sm">
        <h2 className="font-medium">{t("subtitle")}</h2>
        <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
          <li>
            {t("bullet1")}
          </li>
          <li>
            {t.rich("bullet2", { b: (chunks) => <b>{chunks}</b> })}
          </li>
          <li>
            {t.rich("bullet3", { b: (chunks) => <b>{chunks}</b> })}
          </li>
        </ul>
        <a
          href={`/api/deals/template?locale=${locale}`}
          download
          className="inline-block font-medium text-primary underline underline-offset-4"
        >
          {t("template")}
        </a>
      </section>

      <section className="space-y-3 rounded-lg border p-4">
        <ImportDeals />
      </section>
    </div>
  );
}
