"use server";

import type { ErrorKey, ErrorValues } from "@/lib/error-keys";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// profileId возвращается, чтобы клиент сразу переключился в только что
// созданный шаблон и дальнейшие правки писались уже в него.
export type ProfileState = { error?: ErrorKey; profileId?: string; errorValues?: ErrorValues };

const MAX_PROFILES = 20;

// query — строка параметров таблицы («?buy=…&sell=…»), её же кладём в адрес.
const profileSchema = z.object({
  name: z.string().trim().min(1, "nameRequired").max(40, "nameMax40"),
  query: z
    .string()
    .max(2000)
    .refine((v) => v === "" || v.startsWith("?"), "paramsInvalid"),
});

async function requireUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

/** Сохранить текущие настройки таблицы под именем (перезаписывает одноимённый). */
export async function savePriceProfile(
  _prev: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const userId = await requireUserId();
  if (!userId) return { error: "notAuthorized" };

  const parsed = profileSchema.safeParse({
    name: formData.get("name"),
    query: formData.get("query") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { name, query } = parsed.data;

  const existing = await prisma.priceProfile.findUnique({
    where: { userId_name: { userId, name } },
    select: { id: true },
  });
  if (!existing) {
    const count = await prisma.priceProfile.count({ where: { userId } });
    if (count >= MAX_PROFILES) {
      return { error: "profileLimit", errorValues: { max: MAX_PROFILES } };
    }
  }

  const saved = await prisma.priceProfile.upsert({
    where: { userId_name: { userId, name } },
    create: { userId, name, query },
    update: { query },
    select: { id: true },
  });

  revalidatePath("/app/prices");
  return { profileId: saved.id };
}

/**
 * Автосохранение: пока шаблон выбран, любое изменение фильтров пишется в него.
 * Вызывается из клиента напрямую (без формы), поэтому проверяем и владельца,
 * и формат строки параметров.
 */
export async function updatePriceProfileQuery(id: string, query: string): Promise<void> {
  const userId = await requireUserId();
  if (!userId) return;
  const parsed = profileSchema.shape.query.safeParse(query);
  if (!parsed.success || !id) return;

  await prisma.priceProfile.updateMany({
    where: { id, userId },
    data: { query: parsed.data },
  });
  revalidatePath("/app/prices");
}

/** Удалить шаблон по id (только свой). */
export async function deletePriceProfile(id: string): Promise<void> {
  const userId = await requireUserId();
  if (!userId || !id) return;

  await prisma.priceProfile.deleteMany({ where: { id, userId } });
  revalidatePath("/app/prices");
}
