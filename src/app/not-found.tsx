import Link from "next/link";
import { connection } from "next/server";
import { Button } from "@/components/ui/button";

/**
 * Своя страница 404 нужна не ради оформления: встроенная собирается на билде
 * как статическая, а CSP с nonce требует рендера на запрос. Без этого её
 * скрипты приезжали без nonce и блокировались браузером (проверено — 16
 * нарушений CSP на дефолтной странице).
 */
export default async function NotFound() {
  await connection();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-3xl font-bold">Страница не найдена</h1>
      <p className="text-muted-foreground">
        Ссылка устарела или адрес набран с опечаткой.
      </p>
      <Button nativeButton={false} render={<Link href="/" />}>
        На главную
      </Button>
    </main>
  );
}
