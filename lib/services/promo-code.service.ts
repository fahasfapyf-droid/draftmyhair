import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export function normalizePromoCode(code: string) {
  return code.trim().toUpperCase();
}

export async function redeemPromoCode(userId: string, rawCode: string) {
  const code = normalizePromoCode(rawCode);
  if (!/^[A-Z0-9_-]{3,64}$/.test(code)) throw new Error("Invalid promo code.");

  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{ id: string; credits: number; maxRedemptions: number | null; redeemedCount: number; startsAt: Date | null; expiresAt: Date | null; isActive: boolean; code: string }>>(Prisma.sql`
      SELECT "id", "credits", "maxRedemptions", "redeemedCount", "startsAt", "expiresAt", "isActive", "code"
      FROM "PromoCode" WHERE "code" = ${code} LIMIT 1 FOR UPDATE`);
    const promo = rows[0];
    if (!promo || !promo.isActive) throw new Error("Invalid or inactive promo code.");
    const now = new Date();
    if (promo.startsAt && promo.startsAt > now) throw new Error("This promo code is not active yet.");
    if (promo.expiresAt && promo.expiresAt <= now) throw new Error("This promo code has expired.");
    if (promo.maxRedemptions !== null && promo.redeemedCount >= promo.maxRedemptions) throw new Error("This promo code has reached its usage limit.");

    const existing = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT "id" FROM "PromoRedemption" WHERE "promoCodeId" = ${promo.id} AND "userId" = ${userId} LIMIT 1`);
    if (existing.length) throw new Error("You have already redeemed this promo code.");

    const walletRows = await tx.$queryRaw<Array<{ id: string; balance: number }>>(Prisma.sql`SELECT "id", "balance" FROM "Wallet" WHERE "userId" = ${userId} FOR UPDATE`);
    let wallet = walletRows[0];
    if (!wallet) {
      const created = await tx.$queryRaw<Array<{ id: string; balance: number }>>(Prisma.sql`INSERT INTO "Wallet" ("id","userId","balance","createdAt","updatedAt") VALUES (gen_random_uuid()::text, ${userId}, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING "id","balance"`);
      wallet = created[0];
    }

    const balanceBefore = wallet.balance;
    const balanceAfter = balanceBefore + promo.credits;
    const redemptionId = crypto.randomUUID();
    await tx.$executeRaw(Prisma.sql`INSERT INTO "PromoRedemption" ("id","promoCodeId","userId","creditsGranted","redeemedAt") VALUES (${redemptionId}, ${promo.id}, ${userId}, ${promo.credits}, CURRENT_TIMESTAMP)`);
    await tx.$executeRaw(Prisma.sql`UPDATE "PromoCode" SET "redeemedCount" = "redeemedCount" + 1, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = ${promo.id}`);
    await tx.$executeRaw(Prisma.sql`UPDATE "Wallet" SET "balance" = "balance" + ${promo.credits}, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = ${wallet.id}`);
    await tx.$executeRaw(Prisma.sql`INSERT INTO "CreditTransaction" ("id","walletId","type","amount","balanceBefore","balanceAfter","description","metadata","createdAt") VALUES (${crypto.randomUUID()}, ${wallet.id}, 'BONUS', ${promo.credits}, ${balanceBefore}, ${balanceAfter}, ${`Promo code ${promo.code}`}, ${JSON.stringify({ promoCodeId: promo.id, promoCode: promo.code, redemptionId })}::jsonb, CURRENT_TIMESTAMP)`);
    return { credits: promo.credits, balance: balanceAfter };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function createPromoCode(input: { code: string; credits: number; maxRedemptions?: number | null; startsAt?: Date | null; expiresAt?: Date | null }) {
  const code = normalizePromoCode(input.code);
  if (!/^[A-Z0-9_-]{3,64}$/.test(code)) throw new Error("Code must be 3-64 characters using letters, numbers, hyphens or underscores.");
  if (!Number.isInteger(input.credits) || input.credits <= 0) throw new Error("Credits must be a positive whole number.");
  if (input.maxRedemptions != null && (!Number.isInteger(input.maxRedemptions) || input.maxRedemptions <= 0)) throw new Error("Maximum redemptions must be a positive whole number.");
  if (input.startsAt && input.expiresAt && input.expiresAt <= input.startsAt) throw new Error("Expiry must be after the start date.");
  return prisma.$executeRaw(Prisma.sql`INSERT INTO "PromoCode" ("id","code","credits","maxRedemptions","redeemedCount","startsAt","expiresAt","isActive","createdAt","updatedAt") VALUES (${crypto.randomUUID()},${code},${input.credits},${input.maxRedemptions ?? null},0,${input.startsAt ?? null},${input.expiresAt ?? null},true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`);
}

export async function setPromoCodeActive(id: string, isActive: boolean) {
  return prisma.$executeRaw(Prisma.sql`UPDATE "PromoCode" SET "isActive" = ${isActive}, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = ${id}`);
}

export async function getActivePromoCodes() {
  return prisma.$queryRaw<Array<{ id: string; code: string; credits: number; maxRedemptions: number | null; redeemedCount: number; startsAt: Date | null; expiresAt: Date | null; isActive: boolean }>>(Prisma.sql`SELECT "id","code","credits","maxRedemptions","redeemedCount","startsAt","expiresAt","isActive" FROM "PromoCode" ORDER BY "createdAt" DESC`);
}

export async function getPromoRedemptions(promoCodeId: string) {
  return prisma.$queryRaw<Array<{ id: string; name: string | null; email: string | null; creditsGranted: number; redeemedAt: Date }>>(Prisma.sql`SELECT r."id",u."name",u."email",r."creditsGranted",r."redeemedAt" FROM "PromoRedemption" r JOIN "User" u ON u."id"=r."userId" WHERE r."promoCodeId"=${promoCodeId} ORDER BY r."redeemedAt" DESC`);
}

export async function getPromoCode(id: string) {
  const rows = await prisma.$queryRaw<Array<{ id: string; code: string }>>(Prisma.sql`SELECT "id","code" FROM "PromoCode" WHERE "id"=${id} LIMIT 1`);
  return rows[0] ?? null;
}
