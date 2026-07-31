import { prisma } from "@/lib/prisma";

export async function getPaymentHistory(userId: string) {
  return prisma.creditTransaction.findMany({
    where: {
      wallet: {
        userId,
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      type: true,
      amount: true,
      balanceBefore: true,
      balanceAfter: true,
      description: true,
      createdAt: true,
    },
  });
}