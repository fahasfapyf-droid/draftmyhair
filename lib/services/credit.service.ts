import {
  Prisma,
  Wallet,
  WalletTransactionType,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";

export async function ensureWallet(
  userId: string
): Promise<Wallet> {
  const wallet = await prisma.wallet.findUnique({
    where: {
      userId,
    },
  });

  if (wallet) {
    return wallet;
  }

  return prisma.wallet.create({
    data: {
      userId,
      balance: 0,
    },
  });
}

export async function getWallet(
  userId: string
): Promise<Wallet> {
  return ensureWallet(userId);
}

export async function getBalance(
  userId: string
): Promise<number> {
  const wallet = await ensureWallet(userId);

  return wallet.balance;
}

interface AwardCreditsInput {
  userId: string;
  amount: number;
  type: WalletTransactionType;
  description?: string;
  generationId?: string;
  paymentId?: string;
  metadata?: Prisma.InputJsonValue;
}

export async function awardCredits({
  userId,
  amount,
  type,
  description,
  generationId,
  paymentId,
  metadata,
}: AwardCreditsInput) {
  if (amount <= 0) {
    throw new Error(
      "Credit amount must be greater than zero."
    );
  }

  return prisma.$transaction(async (tx) => {
    let wallet = await tx.wallet.findUnique({
      where: {
        userId,
      },
    });

    if (!wallet) {
      wallet = await tx.wallet.create({
        data: {
          userId,
          balance: 0,
        },
      });
    }

    const balanceBefore = wallet.balance;
    const balanceAfter = balanceBefore + amount;

    const updatedWallet = await tx.wallet.update({
      where: {
        id: wallet.id,
      },
      data: {
        balance: balanceAfter,
      },
    });

    const transaction = await tx.creditTransaction.create({
      data: {
        walletId: wallet.id,
        type,
        amount,
        balanceBefore,
        balanceAfter,
        description,
        generationId,
        paymentId,
        ...(metadata !== undefined
          ? { metadata }
          : {}),
      },
    });

    return {
      wallet: updatedWallet,
      transaction,
    };
  });
}

interface ConsumeCreditsInput {
  userId: string;
  amount?: number;
  description?: string;
  generationId?: string;
  metadata?: Prisma.InputJsonValue;
}

export async function consumeCredits({
  userId,
  amount = 1,
  description = "AI hairstyle generation",
  generationId,
  metadata,
}: ConsumeCreditsInput) {
  if (amount <= 0) {
    throw new Error(
      "Credit amount must be greater than zero."
    );
  }

  return prisma.$transaction(async (tx) => {
    let wallet = await tx.wallet.findUnique({
      where: {
        userId,
      },
    });

    if (!wallet) {
      wallet = await tx.wallet.create({
        data: {
          userId,
          balance: 0,
        },
      });
    }

    if (wallet.balance < amount) {
      throw new Error("Insufficient credits.");
    }

    const balanceBefore = wallet.balance;
    const balanceAfter = balanceBefore - amount;

    const updatedWallet = await tx.wallet.update({
      where: {
        id: wallet.id,
      },
      data: {
        balance: balanceAfter,
      },
    });

    const transaction = await tx.creditTransaction.create({
      data: {
        walletId: wallet.id,
        type: WalletTransactionType.DEBIT,
        amount,
        balanceBefore,
        balanceAfter,
        description,
        generationId,
        ...(metadata !== undefined
          ? { metadata }
          : {}),
      },
    });

    return {
      wallet: updatedWallet,
      transaction,
    };
  });
}

interface RefundCreditsInput {
  userId: string;
  amount?: number;
  description?: string;
  generationId?: string;
  metadata?: Prisma.InputJsonValue;
}

export async function refundCredits({
  userId,
  amount = 1,
  description = "Generation refund",
  generationId,
  metadata,
}: RefundCreditsInput) {
  if (amount <= 0) {
    throw new Error(
      "Credit amount must be greater than zero."
    );
  }

  return prisma.$transaction(async (tx) => {
    let wallet = await tx.wallet.findUnique({
      where: {
        userId,
      },
    });

    if (!wallet) {
      wallet = await tx.wallet.create({
        data: {
          userId,
          balance: 0,
        },
      });
    }

    const balanceBefore = wallet.balance;
    const balanceAfter = balanceBefore + amount;

    const updatedWallet = await tx.wallet.update({
      where: {
        id: wallet.id,
      },
      data: {
        balance: balanceAfter,
      },
    });

    const transaction = await tx.creditTransaction.create({
      data: {
        walletId: wallet.id,
        type: WalletTransactionType.REFUND,
        amount,
        balanceBefore,
        balanceAfter,
        description,
        generationId,
        ...(metadata !== undefined
          ? { metadata }
          : {}),
      },
    });

    return {
      wallet: updatedWallet,
      transaction,
    };
  });
}