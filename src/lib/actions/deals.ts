"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { dealData } from "@/lib/deal-data";
import { dealSchema, type DealInput } from "@/lib/validation";
import { fxFactor } from "@/lib/currency";
import { getRates } from "@/lib/rates";

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

  // Одиночные предметы (агент/кейс/капсула/брелок/патч/граффити/музкит/…):
  // без вариантов, ищем по семейству и виду.
  if (d.itemKind && d.itemKind !== "skin") {
    const item = await prisma.marketItem.findFirst({
      where: { familyId: d.skinFamilyId, kind: d.itemKind },
    });
    if (!item) throw new DealError("Выбранный предмет не найден в справочнике");
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

    // Курс к базовой валюте вычисляет сервер из парсера курсов (авто-
    // конвертация). Форма ручной ввод не шлёт — сохраняем снимок курса
    // на момент сделки; отображение всё равно пересчитывается по текущим.
    const [{ baseCurrency }, { rates }] = await Promise.all([
      prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { baseCurrency: true },
      }),
      getRates(),
    ]);
    const buyFx = fxFactor(parsed.data.buyCurrency, baseCurrency, rates);
    const sellCur = parsed.data.sellCurrency ?? parsed.data.buyCurrency;
    const sellFx = fxFactor(sellCur, baseCurrency, rates);
    // Без курса сохранять нельзя: 1:1 занизил бы сумму в разы и осел бы в БД.
    if (buyFx == null || sellFx == null) {
      return { error: "Курс валюты недоступен — попробуйте позже" };
    }
    parsed.data.buyFxRate = buyFx;
    parsed.data.sellFxRate = sellFx;

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

export async function deleteAllDealsAction(
  _prev: DealFormState,
  formData: FormData,
): Promise<DealFormState> {
  try {
    const userId = await requireUserId();
    // Явное подтверждение из формы — защита от случайного сабмита.
    if (formData.get("confirm")?.toString() !== "yes") {
      return { error: "Удаление не подтверждено" };
    }
    await prisma.deal.deleteMany({ where: { userId } });

    revalidatePath("/app/deals");
    revalidatePath("/app");
    return { success: true };
  } catch (e) {
    console.error("deleteAllDealsAction", e);
    return { error: "Не удалось удалить сделки" };
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
