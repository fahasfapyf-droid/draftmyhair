import argon2 from "argon2";

import { prisma } from "@/lib/prisma";

export async function loginUser(
  email: string,
  password: string
) {
  console.log("================================");
  console.log("LOGIN ATTEMPT");
  console.log("EMAIL:", email);

  const user = await prisma.user.findUnique({
    where: {
      email,
    },
  });

  console.log("USER FOUND:", !!user);

  // User does not exist
  if (!user) {
    return null;
  }

  console.log("HASH EXISTS:", !!user.passwordHash);

  // User has no password (OAuth account, etc.)
  if (!user.passwordHash) {
    return null;
  }

  const validPassword = await argon2.verify(
    user.passwordHash,
    password
  );

  console.log("PASSWORD VALID:", validPassword);

  // Wrong password
  if (!validPassword) {
    return null;
  }

  // Block login until email is verified
  if (!user.emailVerified) {
  console.log("EMAIL NOT VERIFIED");
  return null;
}

  console.log("LOGIN SUCCESS");

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };
}