"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export type PlatformState = { error?: string; success?: boolean };

const MAX_PLATFORMS = 50;

const feePct = z.coerce
  .number({ error: "Комиссия — число 0–100" })
  .min(0, "Комиссия 0–100 %")
  .max(100, "Комиссия 0–100 %");

const platformSchema = z.object({
  name: z.string().trim().min(1, "Укажите название").max(60, "Слишком длинное название"),
  buyFeePct: feePct,
  sellFeePct: feePct,
});

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("unauthorized");
  return session.user.id;
}

function parseForm(formData: FormData) {
  return platformSchema.safeParse({
    name: formData.get("name"),
    buyFeePct: formData.get("buyFeePct"),
    sellFeePct: formData.get("sellFeePct"),
  });
}

// Не даём заводить дубль по имени (без регистра) — ни своих, ни сидовых.
async function nameTaken(
  userId: string,
  name: string,
  exceptId?: string,
): Promise<boolean> {
  const rows = await prisma.platform.findMany({
    where: { OR: [{ isCustom: false }, { userId }] },
    select: { id: true, name: true },
  });
  const norm = name.trim().toLowerCase();
  return rows.some((p) => p.name.trim().toLowerCase() === norm && p.id !== exceptId);
}

export async function createPlatformAction(
  _prev: PlatformState,
  formData: FormData,
): Promise<PlatformState> {
  try {
    const userId = await requireUserId();
    const parsed = parseForm(formData);
    if (!parsed.success) return { error: parsed.error.issues[0].message };

    const own = await prisma.platform.count({ where: { userId, isCustom: true } });
    if (own >= MAX_PLATFORMS) {
      return { error: `Достигнут лимит площадок (${MAX_PLATFORMS})` };
    }
    if (await nameTaken(userId, parsed.data.name)) {
      return { error: "Площадка с таким названием уже есть" };
    }

    await prisma.platform.create({
      data: {
        userId,
        name: parsed.data.name,
        defaultBuyFeePct: parsed.data.buyFeePct,
        defaultSellFeePct: parsed.data.sellFeePct,
        isCustom: true,
      },
    });
    revalidatePath("/app/settings");
    revalidatePath("/app/deals");
    return { success: true };
  } catch {
    return { error: "Не удалось создать площадку" };
  }
}

export async function updatePlatformAction(
  _prev: PlatformState,
  formData: FormData,
): Promise<PlatformState> {
  try {
    const userId = await requireUserId();
    const id = formData.get("id")?.toString() ?? "";
    const parsed = parseForm(formData);
    if (!parsed.success) return { error: parsed.error.issues[0].message };

    // Редактировать можно только СВОЮ кастомную площадку.
    const existing = await prisma.platform.findFirst({
      where: { id, userId, isCustom: true },
    });
    if (!existing) return { error: "Площадка не найдена" };
    if (await nameTaken(userId, parsed.data.name, id)) {
      return { error: "Площадка с таким названием уже есть" };
    }

    await prisma.platform.update({
      where: { id },
      data: {
        name: parsed.data.name,
        defaultBuyFeePct: parsed.data.buyFeePct,
        defaultSellFeePct: parsed.data.sellFeePct,
      },
    });
    revalidatePath("/app/settings");
    revalidatePath("/app/deals");
    return { success: true };
  } catch {
    return { error: "Не удалось сохранить площадку" };
  }
}

export async function deletePlatformAction(
  _prev: PlatformState,
  formData: FormData,
): Promise<PlatformState> {
  try {
    const userId = await requireUserId();
    const id = formData.get("id")?.toString() ?? "";
    const existing = await prisma.platform.findFirst({
      where: { id, userId, isCustom: true },
    });
    if (!existing) return { error: "Площадка не найдена" };

    // Нельзя удалить площадку, на которую ссылаются сделки (FK Restrict).
    const used = await prisma.deal.count({
      where: { OR: [{ buyPlatformId: id }, { sellPlatformId: id }] },
    });
    if (used > 0) {
      return { error: `Площадка используется в ${used} сделках — сначала измените их.` };
    }

    await prisma.platform.delete({ where: { id } });
    revalidatePath("/app/settings");
    revalidatePath("/app/deals");
    return { success: true };
  } catch {
    return { error: "Не удалось удалить площадку" };
  }
}
