import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getSkinFamilies } from "@/lib/skins-index";

// Индекс семейств скинов для клиентского автокомплита.
// Доступен только авторизованным; кэшируется браузером на час.
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const families = await getSkinFamilies();
  return NextResponse.json(families, {
    headers: { "Cache-Control": "private, max-age=3600" },
  });
}
