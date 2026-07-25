import { prisma } from "@/lib/prisma";

import {
  createPasswordResetExpiry,
  generatePasswordResetToken,
  hashPasswordResetToken,
} from "./crypto";

/**
 * Creates a new password reset token.
 *
 * Any existing unused tokens are deleted before creating
 * a fresh one.
 */
export async function createPasswordResetToken(
  userId: string
): Promise<string> {
  // Delete every existing unused token for this user
  await prisma.passwordResetToken.deleteMany({
    where: {
      userId,
      usedAt: null,
    },
  });

 const token = generatePasswordResetToken();

const tokenHash = hashPasswordResetToken(token);

const expiresAt = createPasswordResetExpiry();

  await prisma.passwordResetToken.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
    },
  });

  return token;
}

/**
 * Finds a valid password reset token.
 *
 * Returns null if:
 * - token doesn't exist
 * - token expired
 * - token already used
 */
export async function getPasswordResetToken(
  token: string
) {
  const tokenHash =
    hashPasswordResetToken(token);

  return prisma.passwordResetToken.findFirst({
    where: {
      tokenHash,
      usedAt: null,
      expiresAt: {
        gt: new Date(),
      },
    },
    include: {
      user: true,
    },
  });
}

/**
 * Marks a password reset token as used.
 */
export async function markPasswordResetTokenUsed(
  id: string
) {
  await prisma.passwordResetToken.update({
    where: {
      id,
    },
    data: {
      usedAt: new Date(),
    },
  });
}

/**
 * Deletes every expired password reset token.
 *
 * Safe to call whenever a password reset request
 * is created.
 */
export async function deleteExpiredPasswordResetTokens() {
  await prisma.passwordResetToken.deleteMany({
    where: {
      expiresAt: {
        lt: new Date(),
      },
    },
  });
}

/**
 * Removes every password reset token belonging
 * to a specific user.
 *
 * Useful after a successful password reset.
 */
export async function deleteUserPasswordResetTokens(
  userId: string
) {
  await prisma.passwordResetToken.deleteMany({
    where: {
      userId,
    },
  });
}