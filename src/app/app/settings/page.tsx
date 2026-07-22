import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getRates } from "@/lib/rates";
import { CURRENCY_SYMBOL, fxFactor } from "@/lib/currency";
import { CurrencySettings } from "@/components/currency-settings";
import { PasswordSettings } from "@/components/password-settings";
import { CURRENCIES } from "@/lib/validation";

export const metadata: Metadata = { title: "Настройки — SkinLedger" };

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [user, { rates, updatedAt, source }] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: session.user.id },
      // Только нужное поле: без select сюда приезжал и passwordHash.
      select: { baseCurrency: true },
    }),
    getRates(),
  ]);
  const base = user.baseCurrency;

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold">Настройки</h1>

      <section className="rounded-lg border p-4">
        <h2 className="text-sm font-medium">Валюта</h2>
        <p className="mt-1 mb-3 text-sm text-muted-foreground">
          Все суммы (цены, прибыль, дашборд) пересчитываются в основную валюту по
          текущему курсу. При смене валюты все сделки отобразятся в новой валюте.
        </p>
        <CurrencySettings current={base} />
      </section>

      <section className="rounded-lg border p-4">
        <h2 className="text-sm font-medium">Пароль</h2>
        <p className="mt-1 mb-3 text-sm text-muted-foreground">
          После смены пароля все входы на всех устройствах перестают
          действовать — войдите заново с новым паролем.
        </p>
        <PasswordSettings />
      </section>

      <section className="rounded-lg border p-4">
        <h2 className="mb-1 text-sm font-medium">
          Курсы к {base} {CURRENCY_SYMBOL[base] ?? ""}
        </h2>
        <p className="mb-3 text-xs text-muted-foreground">
          {source === "live"
            ? `Обновлено: ${new Date(updatedAt).toLocaleString("ru-RU")}`
            : source === "cache"
              ? `Обновить не удалось, курсы от ${new Date(updatedAt).toLocaleString("ru-RU")}`
              : "Используются запасные курсы (парсер недоступен)"}
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
                    {fxFactor(c, base, rates)?.toLocaleString("ru-RU", {
                      maximumFractionDigits: 3,
                    }) ?? "—"}{" "}
                    {CURRENCY_SYMBOL[base] ?? base}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
