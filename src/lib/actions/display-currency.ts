"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { CURRENCY_COOKIE } from "@/lib/display-currency";
import { BASE_CURRENCIES } from "@/lib/validation";

const YEAR = 60 * 60 * 24 * 365;

/**
 * Переключатель валюты в шапке. Гостю пишем cookie, вошедшему — ещё и
 * основную валюту в профиль: в приложении это валюта учёта, и две разные
 * валюты у одного пользователя расходились бы между приложением и публичной
 * зоной.
 */
export async function setDisplayCurrency(value: string): Promise<void> {
  if (!(BASE_CURRENCIES as readonly string[]).includes(value)) return;

  (await cookies()).set(CURRENCY_COOKIE, value, {
    path: "/",
    maxAge: YEAR,
    sameSite: "lax",
    httpOnly: false,
  });

  const session = await auth();
  if (session?.user?.id) {
    await prisma.user.update({
      where: { id: session.user.id },
      data: { baseCurrency: value },
    });
    revalidatePath("/app");
    revalidatePath("/app/deals");
    revalidatePath("/app/settings");
  }
}
