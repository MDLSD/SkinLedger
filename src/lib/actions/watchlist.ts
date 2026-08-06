"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

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
