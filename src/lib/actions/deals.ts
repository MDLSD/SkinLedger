"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { buyCostBase, sellRevenueBase } from "@/lib/deal-math";
import { dealSchema, type DealInput } from "@/lib/validation";

export type DealFormState = { error?: string; success?: boolean };

// Доменная ошибка: её текст безопасно показывать пользователю.
// Всё остальное (в т.ч. ошибки Prisma с именами моделей/полей) наружу
// не уходит — только генерик-сообщение.
class DealError extends Error {}

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new DealError("Не авторизован");
  return session.user.id;
}

function formToObject(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

async function assertPlatformVisible(platformId: string, userId: string) {
  const platform = await prisma.platform.findFirst({
    where: { id: platformId, OR: [{ isCustom: false }, { userId }] },
  });
  if (!platform) throw new DealError("Площадка не найдена");
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
    itemId: null as string | null,
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
    // Курс уже нормализован в saveDealAction относительно базовой валюты
    // (валюта === базовая ⟹ 1; иначе обязателен). Фолбэк на 1 — страховка.
    sellFxRate: isHolding ? null : (d.sellFxRate ?? 1),
    sellFeePct: isHolding ? null : (d.sellFeePct ?? 0),
    sellDate: isHolding ? null : (d.sellDate ?? null),
    withdrawalDiscountPct,
    note: d.note ?? null,
  };
}

// Резолвим ссылку на каноничный предмет каталога по семейству + варианту
// (скин: износ+ST/SV; стикер: финиш). item_name/item_quality — из каталога.
async function resolveItem(d: DealInput) {
  if (!d.skinFamilyId) return null;

  if (d.itemKind === "sticker") {
    const item = await prisma.marketItem.findFirst({
      where: { familyId: d.skinFamilyId, kind: "sticker", finish: d.finish ?? null },
    });
    if (!item) throw new DealError("Выбранный вариант стикера не найден в справочнике");
    return {
      itemId: item.id,
      itemName: item.stickerName ?? item.marketHashName,
      itemQuality: item.finish,
    };
  }

  if (d.itemKind === "agent") {
    const item = await prisma.marketItem.findFirst({
      where: { familyId: d.skinFamilyId, kind: "agent" },
    });
    if (!item) throw new DealError("Выбранный агент не найден в справочнике");
    return {
      itemId: item.id,
      itemName: item.skinName ?? item.marketHashName,
      itemQuality: null,
    };
  }

  const item = await prisma.marketItem.findFirst({
    where: {
      familyId: d.skinFamilyId,
      kind: "skin",
      wear: d.itemQuality ?? null,
      stattrak: d.stattrak,
      souvenir: d.souvenir,
    },
  });
  if (!item) throw new DealError("Выбранный вариант скина не найден в справочнике");
  return {
    itemId: item.id,
    itemName: item.skinName ? `${item.weapon} | ${item.skinName}` : (item.weapon ?? ""),
    itemQuality: item.wear,
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

    // Курсы задаются к базовой валюте пользователя. Сервер авторитетно
    // нормализует: валюта === базовая ⟹ курс 1; иначе курс обязателен
    // (иначе крафтовый POST без sellFxRate исказил бы прибыль).
    const { baseCurrency } = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { baseCurrency: true },
    });
    if (parsed.data.buyCurrency === baseCurrency) {
      parsed.data.buyFxRate = 1;
    }
    if (parsed.data.status !== "holding") {
      const sellCur = parsed.data.sellCurrency ?? parsed.data.buyCurrency;
      if (sellCur === baseCurrency) {
        parsed.data.sellFxRate = 1;
      } else if (
        !(typeof parsed.data.sellFxRate === "number" && parsed.data.sellFxRate > 0)
      ) {
        return { error: "Укажите курс продажи к базовой валюте" };
      }
    }

    await assertPlatformVisible(parsed.data.buyPlatformId, userId);
    if (parsed.data.status !== "holding" && parsed.data.sellPlatformId) {
      await assertPlatformVisible(parsed.data.sellPlatformId, userId);
    }

    const data = dealData(userId, parsed.data);
    const resolved = await resolveItem(parsed.data);
    if (resolved) {
      data.itemId = resolved.itemId;
      data.itemName = resolved.itemName;
      data.itemQuality = resolved.itemQuality;
    }

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
    return {
      error: e instanceof DealError ? e.message : "Не удалось сохранить сделку",
    };
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
