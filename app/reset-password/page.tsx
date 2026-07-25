import { notFound } from "next/navigation";

import {
  getPasswordResetToken,
} from "@/lib/auth/password-reset";

import ResetPasswordForm from "./ResetPasswordForm";

interface PageProps {
  searchParams: Promise<{
    token?: string;
  }>;
}

export default async function ResetPasswordPage({
  searchParams,
}: PageProps) {
  const { token } = await searchParams;

  if (!token) {
    notFound();
  }

  const resetToken =
    await getPasswordResetToken(token);

  if (!resetToken) {
    return (
      <main className="mx-auto flex min-h-[70vh] max-w-xl items-center justify-center px-6">
        <div className="w-full rounded-editorial border border-red-300 bg-red-50 p-8 text-center">
          <h1 className="mb-4 text-2xl font-semibold">
            Invalid Reset Link
          </h1>

          <p className="text-sm text-red-700">
            This password reset link is invalid,
            expired, or has already been used.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-xl items-center justify-center px-6">
      <div className="w-full rounded-editorial border border-brand-border bg-white p-8 shadow-sm">
        <h1 className="mb-2 text-3xl font-semibold">
          Reset Password
        </h1>

        <p className="mb-8 text-sm text-gray-600">
          Enter your new password below.
        </p>

        <ResetPasswordForm token={token} />
      </div>
    </main>
  );
}