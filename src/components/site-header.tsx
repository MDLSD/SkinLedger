import { getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import { logoutAction } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { SkinSearchBox } from "@/components/skin-search-box";
import { CurrencySwitcher } from "@/components/currency-switcher";
import { LanguageSwitcher } from "@/components/language-switcher";
import { displayCurrency } from "@/lib/display-currency";

// Единая шапка для всех страниц, кроме лендинга: у него своя, с кнопками
// регистрации. Приватные пункты меню показываем всем — гостя они уведут на
// вход, а разная навигация на публичной и приватной странице путала бы.
const NAV = [
  { href: "/app", key: "dashboard" },
  { href: "/app/deals", key: "deals" },
  { href: "/app/prices", key: "prices" },
  { href: "/app/import", key: "import" },
  { href: "/app/settings", key: "settings" },
] as const;

export async function SiteHeader() {
  const t = await getTranslations("nav");
  const session = await auth();
  const user = session?.user?.id
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { baseCurrency: true },
      })
    : null;
  const currency = await displayCurrency(user?.baseCurrency);

  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="mx-auto flex w-full max-w-[1600px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" className="text-lg font-semibold">
          Skin<span className="text-primary">Ledger</span>
        </Link>

        <nav className="flex gap-4 text-sm text-muted-foreground">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="transition-colors hover:text-foreground"
            >
              {t(item.key)}
            </Link>
          ))}
        </nav>

        <SkinSearchBox className="order-last w-full min-w-56 sm:order-none sm:ml-auto sm:max-w-xs" />

        <div className="flex items-center gap-3 text-sm">
          <CurrencySwitcher current={currency} />
          <LanguageSwitcher />
          {session?.user ? (
            <>
              <span className="hidden text-muted-foreground lg:inline">
                {session.user.email}
              </span>
              <form action={logoutAction}>
                <Button variant="outline" size="sm" type="submit">
                  {t("signOut")}
                </Button>
              </form>
            </>
          ) : (
            <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/login" />}>
              {t("signIn")}
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
