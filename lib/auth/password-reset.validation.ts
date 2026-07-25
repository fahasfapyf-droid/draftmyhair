import { z } from "zod";

export const forgotPasswordSchema = z.object({
  email: z
    .email("Please enter a valid email address.")
    .trim()
    .toLowerCase(),
});

export const resetPasswordSchema = z
  .object({
    token: z
      .string()
      .trim()
      .min(1, "Missing reset token."),

    password: z
      .string()
      .min(
        8,
        "Password must be at least 8 characters."
      )
      .max(
        128,
        "Password must be no longer than 128 characters."
      ),

    confirmPassword: z.string(),
  })
  .refine(
    (data) => data.password === data.confirmPassword,
    {
      path: ["confirmPassword"],
      message: "Passwords do not match.",
    }
  );

export type ForgotPasswordInput =
  z.infer<typeof forgotPasswordSchema>;

export type ResetPasswordInput =
  z.infer<typeof resetPasswordSchema>;