import { auth } from "@/auth";
import { exampleCsv } from "@/lib/deal-csv";

// Файл-пример для импорта: заголовок + демонстрационные строки.
// Данных пользователя не отдаёт, но это был единственный неаутентифицированный
// эндпоинт приложения — держим правило «всё под /api закрыто» без исключений.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

  return new Response(exampleCsv(), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="skinledger-template.csv"',
      "Cache-Control": "no-store",
    },
  });
}
