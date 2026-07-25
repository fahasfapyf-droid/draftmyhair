"use server";

import { redirect } from "next/navigation";
import * as argon2 from "argon2";

import { prisma } from "@/lib/prisma";

import { resetPasswordSchema } from "@/lib/auth/password-reset.validation";

import {
  getPasswordResetToken,
  markPasswordResetTokenUsed,
  deleteUserPasswordResetTokens,
} from "@/lib/auth/password-reset";

export interface ResetPasswordState {
  success: boolean;
  message: string;
}

export async function resetPassword(
  _previousState: ResetPasswordState,
  formData: FormData
): Promise<ResetPasswordState> {
  try {
    const parsed = resetPasswordSchema.safeParse({
      token: formData.get("token"),
      password: formData.get("password"),
      confirmPassword: formData.get("confirmPassword"),
    });

    if (!parsed.success) {
      return {
        success: false,
        message:
          parsed.error.issues[0]?.message ??
          "Invalid form submission.",
      };
    }

    const {
      token,
      password,
    } = parsed.data;

    const resetToken =
      await getPasswordResetToken(token);

    if (!resetToken) {
      return {
        success: false,
        message:
          "This password reset link is invalid or has expired.",
      };
    }

    const passwordHash =
      await argon2.hash(password);

    await prisma.user.update({
  where: {
    id: resetToken.userId,
  },
  data: {
    passwordHash,
  },
});

// Invalidate every active login session.
await prisma.session.deleteMany({
  where: {
    userId: resetToken.userId,
  },
});

// Mark the current reset token as used.
await markPasswordResetTokenUsed(
  resetToken.id
);

// Remove every remaining reset token.
await deleteUserPasswordResetTokens(
  resetToken.userId
);
  } catch (error) {
    console.error(
      "Reset password error:",
      error
    );

    return {
      success: false,
      message:
        "Something went wrong. Please try again.",
    };
  }

  redirect(
    "/login?reset=success"
  );
}