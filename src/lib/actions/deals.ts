"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { buyCostBase, sellRevenueBase } from "@/lib/deal-math";
import { dealSchema, type DealInput } from "@/lib/validation";

export type DealFormState = { error?: string; success?: boolean };

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Не авторизован");
  return session.user.id;
}

function formToObject(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

async function assertPlatformVisible(platformId: string, userId: string) {
  const platform = await prisma.platform.findFirst({
    where: { id: platformId, OR: [{ isCustom: false }, { userId }] },
  });
  if (!platform) throw new Error("Площадка не найдена");
}

function dealData(userId: string, d: DealInput) {
  const isHolding = d.status === "holding";
  // Для выводных скинов фиксируем фактическую потерю на выводе в %.
  let withdrawalDiscountPct: number | null = null;
  if (d.status === "withdrawn_via_skin" && d.sellPrice != null) {
    const cost = buyCostBase({
      quantity: d.quantity,
      buyPrice: d.buyPrice,
      buyFeePct: d.buyFeePct,
      buyFxRate: d.buyFxRate,
    });
    const revenue = sellRevenueBase({
      quantity: d.quantity,
      buyPrice: d.buyPrice,
      buyFeePct: d.buyFeePct,
      buyFxRate: d.buyFxRate,
      sellPrice: d.sellPrice,
      sellFeePct: d.sellFeePct,
      sellFxRate: d.sellFxRate,
    });
    if (revenue != null && cost > 0) {
      withdrawalDiscountPct = ((cost - revenue) / cost) * 100;
    }
  }

  return {
    userId,
    itemName: d.itemName,
    itemQuality: d.itemQuality ?? null,
    quantity: d.quantity,
    buyPlatformId: d.buyPlatformId,
    buyPrice: d.buyPrice,
    buyCurrency: d.buyCurrency,
    buyFxRate: d.buyFxRate,
    buyFeePct: d.buyFeePct,
    buyDate: d.buyDate,
    status: d.status,
    sellPlatformId: isHolding ? null : (d.sellPlatformId ?? null),
    sellPrice: isHolding ? null : (d.sellPrice ?? null),
    sellCurrency: isHolding ? null : (d.sellCurrency ?? d.buyCurrency),
    sellFxRate: isHolding ? null : (d.sellFxRate ?? 1),
    sellFeePct: isHolding ? null : (d.sellFeePct ?? 0),
    sellDate: isHolding ? null : (d.sellDate ?? null),
    withdrawalDiscountPct,
    note: d.note ?? null,
  };
}

export async function saveDealAction(
  _prev: DealFormState,
  formData: FormData,
): Promise<DealFormState> {
  try {
    const userId = await requireUserId();
    const dealId = formData.get("dealId")?.toString() || null;

    const parsed = dealSchema.safeParse(formToObject(formData));
    if (!parsed.success) {
      console.error(
        "saveDealAction validation:",
        parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
      );
      return { error: parsed.error.issues[0].message };
    }

    await assertPlatformVisible(parsed.data.buyPlatformId, userId);
    if (parsed.data.status !== "holding" && parsed.data.sellPlatformId) {
      await assertPlatformVisible(parsed.data.sellPlatformId, userId);
    }

    const data = dealData(userId, parsed.data);

    if (dealId) {
      const existing = await prisma.deal.findFirst({
        where: { id: dealId, userId },
      });
      if (!existing) return { error: "Сделка не найдена" };
      await prisma.deal.update({ where: { id: dealId }, data });
    } else {
      await prisma.deal.create({ data });
    }

    revalidatePath("/app/deals");
    revalidatePath("/app");
    return { success: true };
  } catch (e) {
    console.error("saveDealAction", e);
    return { error: e instanceof Error ? e.message : "Не удалось сохранить сделку" };
  }
}

export async function deleteDealAction(
  _prev: DealFormState,
  formData: FormData,
): Promise<DealFormState> {
  try {
    const userId = await requireUserId();
    const dealId = formData.get("dealId")?.toString();
    if (!dealId) return { error: "Сделка не указана" };

    const existing = await prisma.deal.findFirst({
      where: { id: dealId, userId },
    });
    if (!existing) return { error: "Сделка не найдена" };

    await prisma.deal.delete({ where: { id: dealId } });

    revalidatePath("/app/deals");
    revalidatePath("/app");
    return { success: true };
  } catch (e) {
    console.error("deleteDealAction", e);
    return { error: "Не удалось удалить сделку" };
  }
}
