import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { DealsClient } from "@/components/deals-client";
import type { DealDTO, PlatformDTO } from "@/lib/types";

export const metadata: Metadata = { title: "Сделки — SkinLedger" };

function toDateStr(d: Date | null): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

export default async function DealsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const [user, platformRows, dealRows, nameRows] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId } }),
    prisma.platform.findMany({
      where: { OR: [{ isCustom: false }, { userId }] },
      orderBy: [{ isCustom: "asc" }, { name: "asc" }],
    }),
    prisma.deal.findMany({
      where: { userId },
      include: { buyPlatform: true, sellPlatform: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.deal.findMany({
      where: { userId },
      select: { itemName: true },
      distinct: ["itemName"],
      orderBy: { updatedAt: "desc" },
      take: 300,
    }),
  ]);

  const platforms: PlatformDTO[] = platformRows.map((p) => ({
    id: p.id,
    name: p.name,
    defaultBuyFeePct: Number(p.defaultBuyFeePct),
    defaultSellFeePct: Number(p.defaultSellFeePct),
    isCustom: p.isCustom,
  }));

  const deals: DealDTO[] = dealRows.map((d) => ({
    id: d.id,
    itemName: d.itemName,
    itemQuality: d.itemQuality,
    quantity: d.quantity,
    buyPlatformId: d.buyPlatformId,
    buyPlatformName: d.buyPlatform.name,
    buyPrice: Number(d.buyPrice),
    buyCurrency: d.buyCurrency,
    buyFxRate: Number(d.buyFxRate),
    buyFeePct: Number(d.buyFeePct),
    buyDate: toDateStr(d.buyDate)!,
    status: d.status,
    sellPlatformId: d.sellPlatformId,
    sellPlatformName: d.sellPlatform?.name ?? null,
    sellPrice: d.sellPrice != null ? Number(d.sellPrice) : null,
    sellCurrency: d.sellCurrency,
    sellFxRate: d.sellFxRate != null ? Number(d.sellFxRate) : null,
    sellFeePct: d.sellFeePct != null ? Number(d.sellFeePct) : null,
    sellDate: toDateStr(d.sellDate),
    note: d.note,
  }));

  return (
    <DealsClient
      deals={deals}
      platforms={platforms}
      itemNames={nameRows.map((r) => r.itemName)}
      baseCurrency={user.baseCurrency}
    />
  );
}
