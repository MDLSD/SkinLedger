"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { BASE_CURRENCIES } from "@/lib/validation";

export type SettingsState = { error?: string; success?: boolean };

export async function setBaseCurrencyAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Не авторизован" };

  const value = formData.get("baseCurrency")?.toString() ?? "";
  if (!(BASE_CURRENCIES as readonly string[]).includes(value)) {
    return { error: "Недопустимая валюта" };
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { baseCurrency: value },
  });

  // Все суммы пересчитываются в новую базовую валюту.
  revalidatePath("/app");
  revalidatePath("/app/deals");
  revalidatePath("/app/settings");
  return { success: true };
}
