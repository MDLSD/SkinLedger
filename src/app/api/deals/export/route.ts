import type { NextRequest } from "next/server";
import { auth } from "@/auth";
import { loadUserDeals } from "@/lib/deal-query";
import { parseDealFilters } from "@/lib/deal-list";
import { serializeDeals } from "@/lib/deal-csv";
import { checkLimit, recordFailure } from "@/lib/rate-limit";

const EXPORT_LIMIT = 30;
const EXPORT_WINDOW_MS = 10 * 60_000;

// Экспорт текущей выборки сделок в CSV (те же фильтры, что и в списке).
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Экспорт — это полная выборка сделок с тремя JOIN'ами и сборкой CSV.
  // Лимитера на нём не было: дёргать можно было сколько угодно.
  const key = `export:user:${session.user.id}`;
  const limit = checkLimit(key, EXPORT_LIMIT);
  if (limit.limited) {
    return new Response("Too Many Requests", {
      status: 429,
      headers: { "Retry-After": String(limit.retryAfterSec) },
    });
  }
  recordFailure(key, EXPORT_WINDOW_MS);

  const params = Object.fromEntries(request.nextUrl.searchParams.entries());
  const filters = parseDealFilters(params);
  const { deals } = await loadUserDeals(session.user.id, filters);

  const csv = serializeDeals(deals);
  const date = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="skinledger-deals-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
