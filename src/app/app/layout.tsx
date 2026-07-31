import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { SiteHeader } from "@/components/site-header";


export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

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
