import argon2 from "argon2";

import { createEmailVerification } from "@/lib/auth/email-verification";
import { prisma } from "@/lib/prisma";
import { WalletTransactionType } from "@prisma/client";

export async function registerUser(
  name: string,
  email: string,
  password: string
) {
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    throw new Error("Email already exists");
  }

  const passwordHash = await argon2.hash(password);

  const user = await prisma.$transaction(async (tx) => {
    const createdUser = await tx.user.create({
      data: {
        name,
        email,
        passwordHash,
        wallet: {
          create: { balance: 0 },
        },
      },
      include: { wallet: true },
    });

    const wallet = createdUser.wallet;

    if (!wallet) {
      throw new Error("Unable to initialize wallet.");
    }

    await tx.wallet.update({
      where: { id: wallet.id },
      data: { balance: { increment: 5 } },
    });

    await tx.creditTransaction.create({
      data: {
        walletId: wallet.id,
        type: WalletTransactionType.BONUS,
        amount: 5,
        balanceBefore: 0,
        balanceAfter: 5,
        description: "Welcome bonus",
      },
    });

    return createdUser;
  });

  let verificationEmailSent = true;

  try {
    await createEmailVerification(user.id, email, user.name);
  } catch (error) {
    verificationEmailSent = false;
    console.error("Registration verification email delivery failed:", error);
  }

  return {
    user,
    verificationEmailSent,
  };
}
