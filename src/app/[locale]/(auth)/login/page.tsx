import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AuthForm } from "@/components/auth-form";
import { loginAction } from "@/lib/actions/auth";
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
  return { title: t("login") };
}

export default async function LoginPage({ params }: { params: Params }) {
  const { locale: rawLocale } = await params;
  const locale = toLocale(rawLocale);
  setRequestLocale(locale);

  return <AuthForm mode="login" action={loginAction} />;
}
