import { auth } from "@/auth";

export default async function DashboardPage() {
  const session = await auth();

  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold">Дашборд</h1>
      <p className="text-muted-foreground">
        Вы вошли как {session?.user?.email}. Здесь появится статистика по вашим
        сделкам (этап 4).
      </p>
    </div>
  );
}
