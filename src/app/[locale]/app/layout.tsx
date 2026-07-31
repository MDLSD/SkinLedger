import { setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { redirect } from "@/i18n/navigation";
import { SiteHeader } from "@/components/site-header";
import { toLocale } from "@/i18n/routing";

export default async function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale = toLocale(rawLocale);
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user) redirect({ href: "/login", locale });

  return (
    // overflow-x-clip нужен страницам во всю ширину (см. /app/prices): срезает
    // выход за край на ширину скроллбара. Клип-контейнер не является
    // скролл-контейнером, поэтому position: sticky внутри продолжает работать.
    <div className="flex min-h-screen flex-col overflow-x-clip">
      <SiteHeader />
      <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-6 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}
