import { NextResponse } from "next/server";
import { clientIpFromHeaders } from "@/lib/client-ip";
import { checkLimit, recordFailure } from "@/lib/rate-limit";
import { MIN_QUERY, quickSearchSkins } from "@/lib/skins-quick-search";

// Поиск по каталогу для строки в шапке. Публичный: страницы предметов, на
// которые он ведёт, тоже публичны (ТЗ 5). Живёт по /api/search, а не под
// /api/skins: тот префикс в proxy.ts требует сессии, и поиск в публичной
// шапке отдавал бы 401 гостю. Лимит по IP — запрос ходит на каждый ввод, а
// под ним поиск по 33 тысячам строк каталога.
const LIMIT = 60;
const WINDOW_MS = 60_000;

export async function GET(req: Request) {
  const key = `skins-search:${clientIpFromHeaders(req.headers)}`;
  const limit = checkLimit(key, LIMIT);
  if (limit.limited) {
    return NextResponse.json(
      { error: "too_many_requests" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } },
    );
  }
  recordFailure(key, WINDOW_MS);

  const q = new URL(req.url).searchParams.get("q") ?? "";
  if (q.trim().length < MIN_QUERY) return NextResponse.json({ hits: [] });

  const hits = await quickSearchSkins(q);
  return NextResponse.json(
    { hits },
    { headers: { "Cache-Control": "public, max-age=60" } },
  );
}
