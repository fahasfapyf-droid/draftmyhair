import { prisma } from "@/lib/prisma";

const WINDOW_MINUTES = 15;
const MAX_REQUESTS = 5;

export async function isPasswordResetRateLimited(
  userId: string
): Promise<boolean> {
  const windowStart = new Date(
    Date.now() - WINDOW_MINUTES * 60 * 1000
  );

  const requestCount = await prisma.passwordResetToken.count({
    where: {
      userId,
      createdAt: {
        gte: windowStart,
      },
    },
  });

  return requestCount >= MAX_REQUESTS;
}