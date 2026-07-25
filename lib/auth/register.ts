import argon2 from "argon2";

import { createEmailVerification } from "@/lib/auth/email-verification";
import { prisma } from "@/lib/prisma";

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

  await createEmailVerification(
    user.id,
    email,
    user.name
  );

  return user;
}