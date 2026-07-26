"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export type ProfileState = { error?: string };

const MAX_PROFILES = 20;

// query — строка параметров таблицы («?buy=…&sell=…»), её же кладём в адрес.
const profileSchema = z.object({
  name: z.string().trim().min(1, "Введите название").max(40, "Не длиннее 40 символов"),
  query: z
    .string()
    .max(2000)
    .refine((v) => v === "" || v.startsWith("?"), "Некорректные параметры"),
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
  if (!userId) return { error: "Не авторизован" };

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
      return { error: `Больше ${MAX_PROFILES} шаблонов не сохранить` };
    }
  }

  await prisma.priceProfile.upsert({
    where: { userId_name: { userId, name } },
    create: { userId, name, query },
    update: { query },
  });

  revalidatePath("/app/prices");
  return {};
}

/** Удалить шаблон по id (только свой). */
export async function deletePriceProfile(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  if (!userId) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await prisma.priceProfile.deleteMany({ where: { id, userId } });
  revalidatePath("/app/prices");
}
