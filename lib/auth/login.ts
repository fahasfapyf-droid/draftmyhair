import argon2 from "argon2";

import { prisma } from "@/lib/prisma";

const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCK_DURATION_MS = 15 * 60 * 1000;

const DUMMY_PASSWORD_HASH =
  "$argon2id$v=19$m=65536,t=3,p=4$Fw2OkOy4cvgPaNCEqKjRIg$sTAwpP9S0NO/yB91YNyBo/Ozmgl3CxthxbyPKd67gJk";

type AuthenticatedUser = {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  sessionVersion: number;
};

export type LoginResult =
  | { status: "SUCCESS"; user: AuthenticatedUser }
  | {
      status:
        | "INVALID_CREDENTIALS"
        | "EMAIL_NOT_VERIFIED"
        | "RATE_LIMITED";
    };

export async function loginUser(
  email: string,
  password: string
): Promise<LoginResult> {
  const user = await prisma.user.findUnique({
    where: { email: email.trim() },
  });

  if (!user || !user.passwordHash) {
    await argon2.verify(DUMMY_PASSWORD_HASH, password).catch(() => false);
    return { status: "INVALID_CREDENTIALS" };
  }

  if (
    user.loginLockedUntil &&
    user.loginLockedUntil.getTime() > Date.now()
  ) {
    return { status: "RATE_LIMITED" };
  }

  const validPassword = await argon2.verify(
    user.passwordHash,
    password
  );

  if (!validPassword) {
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: { increment: 1 },
      },
      select: { failedLoginAttempts: true },
    });

    if (updatedUser.failedLoginAttempts >= MAX_FAILED_LOGIN_ATTEMPTS) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          loginLockedUntil: new Date(Date.now() + LOGIN_LOCK_DURATION_MS),
        },
      });
    }

    return { status: "INVALID_CREDENTIALS" };
  }

  if (!user.emailVerified) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        loginLockedUntil: null,
      },
    });

    return { status: "EMAIL_NOT_VERIFIED" };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      failedLoginAttempts: 0,
      loginLockedUntil: null,
      lastLoginAt: new Date(),
    },
  });

  return {
    status: "SUCCESS",
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      sessionVersion: user.sessionVersion,
    },
  };
}
