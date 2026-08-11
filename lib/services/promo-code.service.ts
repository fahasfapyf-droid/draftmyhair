import { Prisma, WalletTransactionType } from "@prisma/client";

import { prisma } from "@/lib/prisma";

const MAX_TRANSACTION_RETRIES = 3;

async function runTransaction<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>) {
  for (let attempt = 1; attempt <= MAX_TRANSACTION_RETRIES; attempt += 1) {
    try {
      return await prisma.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        !["P2002", "P2034"].includes(error.code) ||
        attempt === MAX_TRANSACTION_RETRIES
      ) throw error;
    }
  }
  throw new Error("Promo code transaction could not be completed.");
}

export function normalizePromoCode(code: string) {
  return code.trim().toUpperCase();
}

export async function redeemPromoCode(userId: string, rawCode: string) {
  const code = normalizePromoCode(rawCode);
  if (!code || code.length > 64) throw new Error("Invalid promo code.");

  return runTransaction(async (tx) => {
    const promo = await tx.promoCode.findUnique({ where: { code } });
    if (!promo || !promo.isActive) throw new Error("Invalid or inactive promo code.");

    const now = new Date();
    if (promo.startsAt && promo.startsAt > now) throw new Error("This promo code is not active yet.");
    if (promo.expiresAt && promo.expiresAt <= now) throw new Error("This promo code has expired.");

    const existing = await tx.promoRedemption.findUnique({
      where: { promoCodeId_userId: { promoCodeId: promo.id, userId } },
    });
    if (existing) throw new Error("You have already redeemed this promo code.");

    if (promo.maxRedemptions !== null && promo.redeemedCount >= promo.maxRedemptions) {
      throw new Error("This promo code has reached its usage limit.");
    }

    const wallet = await tx.wallet.upsert({
      where: { userId },
      update: {},
      create: { userId, balance: 0 },
    });
    const balanceBefore = wallet.balance;
    const balanceAfter = balanceBefore + promo.credits;

    const redemption = await tx.promoRedemption.create({
      data: { promoCodeId: promo.id, userId, creditsGranted: promo.credits },
    });

    await tx.promoCode.update({
      where: { id: promo.id },
      data: { redeemedCount: { increment: 1 } },
    });

    await tx.wallet.update({
      where: { id: wallet.id },
      data: { balance: { increment: promo.credits } },
    });

    await tx.creditTransaction.create({
      data: {
        walletId: wallet.id,
        type: WalletTransactionType.BONUS,
        amount: promo.credits,
        balanceBefore,
        balanceAfter,
        description: `Promo code ${promo.code}`,
        metadata: { promoCodeId: promo.id, promoCode: promo.code, redemptionId: redemption.id },
      },
    });

    return { credits: promo.credits, balance: balanceAfter };
  });
}

export async function getActivePromoCodes() {
  return prisma.promoCode.findMany({ orderBy: { createdAt: "desc" } });
}

export async function createPromoCode(input: {
  code: string;
  credits: number;
  maxRedemptions?: number | null;
  startsAt?: Date | null;
  expiresAt?: Date | null;
}) {
  const code = normalizePromoCode(input.code);
  if (!/^[A-Z0-9_-]{3,64}$/.test(code)) throw new Error("Code must be 3-64 characters using letters, numbers, hyphens or underscores.");
  if (!Number.isInteger(input.credits) || input.credits <= 0) throw new Error("Credits must be a positive whole number.");
  if (input.maxRedemptions !== null && input.maxRedemptions !== undefined && (!Number.isInteger(input.maxRedemptions) || input.maxRedemptions <= 0)) {
    throw new Error("Maximum redemptions must be a positive whole number.");
  }
  if (input.startsAt && input.expiresAt && input.expiresAt <= input.startsAt) throw new Error("Expiry must be after the start date.");

  return prisma.promoCode.create({
    data: {
      code,
      credits: input.credits,
      maxRedemptions: input.maxRedemptions ?? null,
      startsAt: input.startsAt ?? null,
      expiresAt: input.expiresAt ?? null,
    },
  });
}

export async function setPromoCodeActive(id: string, isActive: boolean) {
  return prisma.promoCode.update({ where: { id }, data: { isActive } });
}

export async function getPromoRedemptions(promoCodeId: string) {
  return prisma.promoRedemption.findMany({
    where: { promoCodeId },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { redeemedAt: "desc" },
  });
}
