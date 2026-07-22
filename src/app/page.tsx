import Link from "next/link";
import { connection } from "next/server";
import { Button } from "@/components/ui/button";

export default async function LandingPage() {
  // CSP с nonce требует динамического рендера: nonce проставляется при SSR
  // из заголовка запроса, а у страницы, собранной на билде, запроса нет —
  // её инлайн-скрипты остались бы без nonce и были бы заблокированы.
  await connection();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-6 text-center">
      <h1 className="max-w-2xl text-4xl font-bold tracking-tight">
        Узнай, сколько ты реально зарабатываешь на арбитраже скинов
      </h1>
      <p className="max-w-xl text-lg text-muted-foreground">
        SkinLedger заменяет эксель-таблицу: заноси сделки, а сервис сам посчитает
        прибыль с учётом комиссий, курсов и выводных скинов.
      </p>
      <div className="flex gap-3">
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
      </div>
    </main>
  );
}
