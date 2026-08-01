import { connection } from "next/server";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { Compass } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { routing } from "@/i18n/routing";
import "./globals.css";

/**
 * Корневая 404 — последний рубеж для адресов, не попавших ни в один сегмент
 * `[locale]` (их ловит `[locale]/[...rest]`, но корневой файл Next требует
 * в любом случае). Рендерит свои `<html>`/`<body>`: корневого layout здесь нет,
 * он живёт под `[locale]`.
 *
 * Язык взять неоткуда — сегмент локали в такой URL не попал, поэтому
 * показываем язык по умолчанию.
 */
export default async function RootNotFound() {
  await connection();
  const messages = await getMessages({ locale: routing.defaultLocale });
  const t = (key: string) =>
    (messages.notFound as Record<string, string>)[key] ?? key;

  return (
    <html lang={routing.defaultLocale} className="dark h-full antialiased">
      <body className="min-h-full bg-background text-foreground">
        <NextIntlClientProvider locale={routing.defaultLocale} messages={messages}>
          <main className="flex min-h-screen flex-col items-center justify-center gap-5 p-6 text-center">
            <div className="flex size-14 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary">
              <Compass className="size-7" />
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl font-bold">404</h1>
              <p className="max-w-sm text-muted-foreground">{t("description")}</p>
            </div>
            <Button nativeButton={false} render={<Link href="/" />}>
              {t("home")}
            </Button>
          </main>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
