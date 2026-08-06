"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { limitsFor } from "@/lib/plan";

/** Состояние предмета в списках пользователя. null — ни в одном. */
export type WatchKind = "favorite" | "blocked" | null;

const KINDS = ["favorite", "blocked"] as const;

/**
 * Переключить предмет между «в избранном», «в чёрном списке» и «нигде».
 * Одна строка на пару (пользователь, предмет): предмет не может быть
 * одновременно избранным и скрытым, поэтому upsert, а не вставка.
 */
export async function setWatchState(marketHashName: string, kind: WatchKind): Promise<void> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return;

  const item = marketHashName.trim().slice(0, 200);
  if (!item) return;

  // Избранное ограничено тарифом; чёрный список — нет: он ничего не открывает.
  if (kind === "favorite") {
    const [count, planUser] = await Promise.all([
      prisma.watchItem.count({ where: { userId, kind: "favorite" } }),
      prisma.user.findUnique({ where: { id: userId }, select: { plan: true, planUntil: true } }),
    ]);
    const already = await prisma.watchItem.findUnique({
      where: { userId_marketHashName: { userId, marketHashName: item } },
      select: { kind: true },
    });
    if (already?.kind !== "favorite" && count >= limitsFor(planUser).maxFavorites) return;
  }

  if (kind == null) {
    await prisma.watchItem.deleteMany({ where: { userId, marketHashName: item } });
  } else {
    if (!(KINDS as readonly string[]).includes(kind)) return;
    await prisma.watchItem.upsert({
      where: { userId_marketHashName: { userId, marketHashName: item } },
      create: { userId, marketHashName: item, kind },
      update: { kind },
    });
  }

  revalidatePath("/app/prices");
}

/** Вернуть в таблицу все скрытые предметы разом. */
export async function clearHiddenItems(): Promise<void> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return;

  await prisma.watchItem.deleteMany({ where: { userId, kind: "blocked" } });
  revalidatePath("/app/prices");
}
