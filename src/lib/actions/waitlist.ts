"use server";

import { z } from "zod";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { checkLimit, recordFailure } from "@/lib/rate-limit";
import { clientIpFromHeaders } from "@/lib/client-ip";

const schema = z.object({
  email: z.email("Некорректный email"),
  feature: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.string().max(100).optional(),
  ),
});

// Заявки — дешёвый сигнал спроса, но форма публичная: режем спам по IP.
const LIMIT = 10;
const WINDOW_MS = 60 * 60_000;

export type WaitlistState = { error?: string; success?: boolean };

export async function joinWaitlistAction(
  _prev: WaitlistState,
  formData: FormData,
): Promise<WaitlistState> {
  const parsed = schema.safeParse({
    email: formData.get("email"),
    feature: formData.get("feature"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const ip = clientIpFromHeaders(await headers());
  const key = `waitlist:ip:${ip}`;
  if (checkLimit(key, LIMIT).limited) {
    return { error: "Слишком много заявок. Попробуйте позже." };
  }
  recordFailure(key, WINDOW_MS);

  await prisma.lead.create({
    data: {
      email: parsed.data.email.toLowerCase(),
      feature: parsed.data.feature ?? null,
    },
  });
  return { success: true };
}
