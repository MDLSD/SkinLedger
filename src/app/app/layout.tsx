import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { logoutAction } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";

const nav = [
  { href: "/app", label: "Дашборд" },
  { href: "/app/deals", label: "Сделки" },
  { href: "/app/import", label: "Импорт" },
  { href: "/app/settings", label: "Настройки" },
];

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/app" className="text-lg font-semibold">
            Skin<span className="text-primary">Ledger</span>
          </Link>
          <nav className="flex gap-4 text-sm text-muted-foreground">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="transition-colors hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="hidden text-muted-foreground sm:inline">
              {session.user.email}
            </span>
            <form action={logoutAction}>
              <Button variant="outline" size="sm" type="submit">
                Выйти
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        {children}
      </main>
    </div>
  );
}
