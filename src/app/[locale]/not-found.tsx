import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { Compass } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";

/**
 * Своя страница 404 нужна не ради оформления: встроенная собирается на билде
 * как статическая, а CSP с nonce требует рендера на запрос. Без этого её
 * скрипты приезжали без nonce и блокировались браузером (проверено — 16
 * нарушений CSP на дефолтной странице).
 */
export default async function NotFound() {
  await connection();
  const t = await getTranslations("notFound");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-5 p-6 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary">
        <Compass className="size-7" />
      </div>
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">
          {t.rich("code", { s: (chunks) => <span className="text-primary">{chunks}</span> })}
        </h1>
        <p className="max-w-sm text-muted-foreground">
          {t("description")}
        </p>
      </div>
      <Button nativeButton={false} render={<Link href="/" />}>
        {t("home")}
      </Button>
    </main>
  );
}
