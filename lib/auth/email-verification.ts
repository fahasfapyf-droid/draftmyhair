import crypto from "crypto";

import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email/mail";
import VerifyEmail from "@/lib/email/templates/verify-email";

const EXPIRY_HOURS = 24;

export async function createEmailVerification(
  userId: string,
  email: string,
  name?: string | null
)
{
  // Remove any existing verification tokens
  await prisma.verificationToken.deleteMany({
    where: {
      identifier: email,
    },
  });

  const token = crypto.randomBytes(32).toString("hex");

  const expires = new Date(
    Date.now() + EXPIRY_HOURS * 60 * 60 * 1000
  );

  await prisma.verificationToken.create({
    data: {
      identifier: email,
      token,
      expires,
    },
  });

  const baseUrl =
    process.env.NEXTAUTH_URL ??
    process.env.NEXT_PUBLIC_APP_URL;

  if (!baseUrl) {
    throw new Error(
      "Missing NEXTAUTH_URL or NEXT_PUBLIC_APP_URL."
    );
  }

  const verificationUrl =
    `${baseUrl}/verify-email?token=${token}`;

  await sendEmail({
    to: email,
    subject: "Verify your Draft My Hair account",
    react: VerifyEmail({
      name,
      verificationUrl,
    }),
  });
}