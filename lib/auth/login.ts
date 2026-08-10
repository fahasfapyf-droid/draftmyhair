import argon2 from "argon2";

import { prisma } from "@/lib/prisma";

export async function loginUser(
  email: string,
  password: string
) {
  const user = await prisma.user.findUnique({
    where: {
      email,
    },
  });

  if (!user) {
    return null;
  }

  if (!user.passwordHash) {
    return null;
  }

  const validPassword = await argon2.verify(
    user.passwordHash,
    password
  );

  if (!validPassword) {
    return null;
  }

  if (!user.emailVerified) {
    return null;
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    sessionVersion: user.sessionVersion,
  };
}
