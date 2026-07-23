import Link from "next/link";
import { connection } from "next/server";
import { BarChart3, Boxes, Coins, FileSpreadsheet, Wallet } from "lucide-react";
import { auth } from "@/auth";
import { Button } from "@/components/ui/button";
import { WaitlistForm } from "@/components/waitlist-form";

const FEATURES = [
  {
    icon: Wallet,
    title: "Настоящая прибыль",
    text: "Учёт покупок и продаж с комиссиями площадок, курсами валют и выводными скинами — видишь чистую прибыль, а не «на глаз».",
  },
  {
    icon: BarChart3,
    title: "Дашборд с графиками",
    text: "Прибыль по месяцам, кумулятивная кривая, топ-5 прибыльных и убыточных, разбивка по площадкам продажи.",
  },
  {
    icon: FileSpreadsheet,
    title: "Импорт за минуты",
    text: "Загрузи свою таблицу Excel/CSV или вставь текст из заметок — колонки, валюты и даты распознаются автоматически.",
  },
  {
    icon: Coins,
    title: "Мультивалюта",
    text: "RUB, USD, EUR, CNY с авто-курсом. Меняешь основную валюту — все сделки пересчитываются на лету.",
  },
  {
    icon: Boxes,
    title: "Каталог ~33 000 предметов",
    text: "Скины, стикеры, агенты, кейсы, капсулы, брелки, патчи, граффити — автоподсказка по названию.",
  },
];

export default async function LandingPage() {
  // CSP с nonce требует динамического рендера: nonce проставляется при SSR
  // из заголовка запроса, а у страницы, собранной на билде, запроса нет.
  await connection();
  const session = await auth();
  const loggedIn = !!session?.user;

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-20 px-4 py-16 sm:py-24">
      {/* Hero */}
      <section className="flex flex-col items-center gap-6 text-center">
        <span className="rounded-full border px-3 py-1 text-xs text-muted-foreground">
          Учёт арбитража скинов CS2
        </span>
        <h1 className="max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">
          Узнай, сколько ты реально зарабатываешь на арбитраже скинов
        </h1>
        <p className="max-w-xl text-lg text-muted-foreground">
          SkinLedger заменяет эксель-таблицу: заноси сделки, а сервис сам
          посчитает прибыль с учётом комиссий, курсов и выводных скинов.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          {loggedIn ? (
            <Button size="lg" nativeButton={false} render={<Link href="/app" />}>
              Открыть приложение
            </Button>
          ) : (
            <>
              <Button size="lg" nativeButton={false} render={<Link href="/register" />}>
                Начать бесплатно
              </Button>
              <Button
                variant="outline"
                size="lg"
                nativeButton={false}
                render={<Link href="/login" />}
              >
                Войти
              </Button>
            </>
          )}
        </div>
      </section>

      {/* Превью интерфейса */}
      <section aria-hidden className="rounded-2xl border bg-muted/30 p-4 sm:p-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <PreviewStat label="Чистая прибыль" value="+18 420 ₽" tone="pos" />
          <PreviewStat label="Оборот" value="212 300 ₽" />
          <PreviewStat label="Средняя маржа" value="14,2 %" tone="pos" />
        </div>
        <div className="mt-3 overflow-hidden rounded-lg border bg-background">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="text-muted-foreground">
              <tr className="border-b">
                <th className="p-2 font-normal">Скин</th>
                <th className="p-2 font-normal">Покупка</th>
                <th className="p-2 font-normal">Продажа</th>
                <th className="p-2 text-right font-normal">Прибыль</th>
              </tr>
            </thead>
            <tbody>
              <PreviewRow
                name="AK-47 | Redline (FT)"
                buy="1 500 ₽"
                sell="2 100 ₽"
                profit="+490 ₽"
                tone="pos"
              />
              <PreviewRow
                name="AWP | Asiimov (WW)"
                buy="4 050 ₽"
                sell="3 700 ₽"
                profit="−560 ₽"
                tone="neg"
              />
              <PreviewRow
                name="★ Karambit | Doppler (FN)"
                buy="52 000 ₽"
                sell="—"
                profit="в холде"
              />
            </tbody>
          </table>
        </div>
      </section>

      {/* Возможности */}
      <section className="flex flex-col gap-8">
        <h2 className="text-center text-2xl font-semibold">Что внутри</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-xl border p-5">
              <f.icon className="size-6 text-primary" />
              <h3 className="mt-3 font-medium">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Планируется */}
      <section className="rounded-2xl border bg-muted/30 p-6 sm:p-8">
        <h2 className="text-2xl font-semibold">Планируется</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Оставь email — напишем, когда появится. Так мы поймём, что делать
          дальше.
        </p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border bg-background p-4">
            <h3 className="font-medium">Автоимпорт из Steam и площадок</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Подтягивать сделки автоматически, без выгрузки таблиц вручную.
            </p>
          </div>
          <div className="rounded-xl border bg-background p-4">
            <h3 className="font-medium">Алерты по ценам</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Уведомления, когда цена интересующего предмета доходит до нужной.
            </p>
          </div>
        </div>
        <div className="mt-5">
          <WaitlistForm feature="planned" />
        </div>
      </section>

      <footer className="border-t pt-6 text-center text-sm text-muted-foreground">
        SkinLedger — учёт арбитража скинов. Интерфейс на русском.
      </footer>
    </main>
  );
}

function PreviewStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "pos" | "neg";
}) {
  const color =
    tone === "pos" ? "text-emerald-600" : tone === "neg" ? "text-red-600" : "";
  return (
    <div className="rounded-lg border bg-background p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 text-lg font-semibold ${color}`}>{value}</div>
    </div>
  );
}

function PreviewRow({
  name,
  buy,
  sell,
  profit,
  tone,
}: {
  name: string;
  buy: string;
  sell: string;
  profit: string;
  tone?: "pos" | "neg";
}) {
  const color =
    tone === "pos" ? "text-emerald-600" : tone === "neg" ? "text-red-600" : "text-muted-foreground";
  return (
    <tr className="border-b last:border-0">
      <td className="p-2">{name}</td>
      <td className="p-2">{buy}</td>
      <td className="p-2">{sell}</td>
      <td className={`p-2 text-right font-medium ${color}`}>{profit}</td>
    </tr>
  );
}
