import argon2 from "argon2";

import { createEmailVerification } from "@/lib/auth/email-verification";
import { prisma } from "@/lib/prisma";
import {
  awardCredits,
} from "@/lib/services/credit.service";
import {
  WalletTransactionType,
} from "@prisma/client";

export async function registerUser(
  name: string,
  email: string,
  password: string
) {
  const existingUser = await prisma.user.findUnique({
    where: {
      email,
    },
  });

  if (existingUser) {
    throw new Error("Email already exists");
  }

  const passwordHash = await argon2.hash(password);

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      wallet: {
        create: {
          balance: 0,
        },
      },
    },
  });
  await awardCredits({
  userId: user.id,
  amount: 5, // Welcome credits
  type: WalletTransactionType.BONUS,
  description: "Welcome bonus",
});

  await createEmailVerification(
    user.id,
    email,
    user.name
  );

  return user;
}