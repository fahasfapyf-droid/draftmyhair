"use server";

import { prisma } from "@/lib/prisma";

import {
  forgotPasswordSchema,
} from "@/lib/auth/password-reset.validation";

import {
  createPasswordResetToken,
  deleteExpiredPasswordResetTokens,
} from "@/lib/auth/password-reset";

import { isPasswordResetRateLimited } from "@/lib/auth/password-reset-rate-limit";

import { sendEmail } from "@/lib/email/mail";
import { PasswordResetEmail } from "@/lib/email/templates/password-reset";

export interface ForgotPasswordState {
  success: boolean;
  message: string;
}

const SUCCESS_MESSAGE =
  "If an account exists with that email address, a password reset link has been sent.";

export async function forgotPassword(
  _previousState: ForgotPasswordState,
  formData: FormData
): Promise<ForgotPasswordState> {
  try {
    const parsed = forgotPasswordSchema.safeParse({
      email: formData.get("email"),
    });

    if (!parsed.success) {
      return {
        success: false,
        message:
          parsed.error.issues[0]?.message ??
          "Please enter a valid email address.",
      };
    }

    const { email } = parsed.data;

    await deleteExpiredPasswordResetTokens();

    const user = await prisma.user.findUnique({
      where: {
        email,
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    /**
     * Never reveal whether an account exists.
     */
    if (!user) {
      return {
        success: true,
        message: SUCCESS_MESSAGE,
      };
    }

    const isRateLimited =
      await isPasswordResetRateLimited(user.id);

    if (isRateLimited) {
      return {
        success: true,
        message: SUCCESS_MESSAGE,
      };
    }

    const token = await createPasswordResetToken(
      user.id
    );

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ??
      process.env.AUTH_URL ??
      "http://localhost:3000";

    const resetUrl = `${baseUrl}/reset-password?token=${token}`;

    if (!user.email) {
      return {
        success: true,
        message: SUCCESS_MESSAGE,
      };
    }

    await sendEmail({
      to: user.email,
      subject: "Reset your Draft My Hair password",
      react: PasswordResetEmail({
        name: user.name ?? undefined,
        resetUrl,
      }),
    });

    return {
      success: true,
      message: SUCCESS_MESSAGE,
    };
  } catch (error) {
    console.error(
      "Forgot password error:",
      error
    );

    return {
      success: false,
      message:
        "Something went wrong. Please try again.",
    };
  }
}