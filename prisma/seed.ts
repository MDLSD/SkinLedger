import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const platforms: { name: string; sellFee: number; buyFee: number }[] = [
  { name: "Steam Market", sellFee: 13, buyFee: 0 },
  { name: "Market.CSGO (TM)", sellFee: 5, buyFee: 0 },
  { name: "CS.Money", sellFee: 7, buyFee: 0 },
  { name: "Buff163", sellFee: 2.5, buyFee: 0 },
  { name: "Skinport", sellFee: 12, buyFee: 0 },
  { name: "DMarket", sellFee: 7, buyFee: 0 },
  { name: "Lis-Skins", sellFee: 5, buyFee: 0 },
  { name: "BitSkins", sellFee: 5, buyFee: 0 },
];

async function main() {
  for (const p of platforms) {
    const existing = await prisma.platform.findFirst({
      where: { name: p.name, isCustom: false },
    });
    if (!existing) {
      await prisma.platform.create({
        data: {
          name: p.name,
          defaultSellFeePct: p.sellFee,
          defaultBuyFeePct: p.buyFee,
          isCustom: false,
        },
      });
    }
  }
  console.log(`Seeded ${platforms.length} platforms`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
