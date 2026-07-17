import { gzipSync } from "node:zlib";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getSkinFamilies } from "@/lib/skins-index";

// Индекс семейств каталога (скины + стикеры) для клиентского автокомплита.
// Доступен только авторизованным; кэшируется браузером на час.
// Ответ крупный (~3 МБ JSON), поэтому отдаём сжатым gzip (~460 КБ), не
// полагаясь на компрессию платформы.
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const families = await getSkinFamilies();
  const body = JSON.stringify(families);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Cache-Control": "private, max-age=3600",
  };

  if (req.headers.get("accept-encoding")?.includes("gzip")) {
    return new Response(gzipSync(body), {
      headers: { ...headers, "Content-Encoding": "gzip", Vary: "Accept-Encoding" },
    });
  }
  return new Response(body, { headers });
}
