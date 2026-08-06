"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export type BillingState = { success?: boolean };

/**
 * Заявка на платный тариф. Платёжного провайдера ещё нет, поэтому вместо
 * оплаты копим спрос в той же таблице заявок, что и лендинг: подключим
 * биллинг — напишем этим людям первыми.
 */
export async function requestProAction(): Promise<BillingState> {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return {};

  // Повторная заявка ничего не ломает, но и дубликат заводить незачем.
  const already = await prisma.lead.findFirst({
    where: { email, feature: "pro" },
    select: { id: true },
  });
  if (!already) {
    await prisma.lead.create({ data: { email, feature: "pro" } });
  }

  revalidatePath("/app/billing");
  return { success: true };
}
