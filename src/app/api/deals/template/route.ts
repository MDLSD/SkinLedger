import type { NextRequest } from "next/server";
import { auth } from "@/auth";
import { exampleCsv } from "@/lib/deal-csv";
import { toLocale } from "@/i18n/routing";

// Файл-пример для импорта: заголовок + демонстрационные строки.
// Данных пользователя не отдаёт, но это был единственный неаутентифицированный
// эндпоинт приложения — держим правило «всё под /api закрыто» без исключений.
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

  // Язык приходит параметром: пути под /api намеренно не локализуются, так что
  // ни префикса, ни заголовка от next-intl здесь нет. На cookie полагаться
  // нельзя — next-intl ставит NEXT_LOCALE не всегда (только когда локаль
  // расходится с Accept-Language).
  const locale = toLocale(request.nextUrl.searchParams.get("locale") ?? "");

  return new Response(exampleCsv(locale), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="skinledger-template.csv"',
      "Cache-Control": "no-store",
    },
  });
}
