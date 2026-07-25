import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { changePassword } from "../actions";
import { PasswordInput } from "@/components/forms/PasswordInput";

interface ChangePasswordPageProps {
  searchParams?: Promise<{
    error?: string;
  }>;
}

export default async function ChangePasswordPage({
  searchParams,
}: ChangePasswordPageProps) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const params = await searchParams;
  const error = params?.error;

  const errorMessage =
    error === "incorrect-password"
      ? "Current password is incorrect."
      : error === "password-too-short"
      ? "Password must be at least 8 characters."
      : error === "passwords-do-not-match"
      ? "Passwords do not match."
      : error === "same-password"
      ? "New password must be different from your current password."
      : error === "missing-fields"
      ? "Please complete all fields."
      : error === "user-not-found"
      ? "Unable to find your account."
      : null;

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="text-3xl font-semibold">
        Change Password
      </h1>

      <p className="mt-2 text-brand-muted">
        Update your account password.
      </p>

      {errorMessage && (
        <div className="mt-8 rounded-editorial border border-red-300 bg-red-50 px-5 py-4 text-red-700">
          {errorMessage}
        </div>
      )}

      <form
        action={changePassword}
        className="mt-10 space-y-6"
      >
        <PasswordInput
          id="currentPassword"
          name="currentPassword"
          label="Current Password"
          required
        />

        <PasswordInput
          id="newPassword"
          name="newPassword"
          label="New Password"
          required
          minLength={8}
        />

        <PasswordInput
          id="confirmPassword"
          name="confirmPassword"
          label="Confirm New Password"
          required
          minLength={8}
        />

        <div className="flex gap-4">
          <button
            type="submit"
            className="rounded-editorial bg-brand-ink px-6 py-3 text-white transition-opacity hover:opacity-90"
          >
            Update Password
          </button>

          <Link
            href="/dashboard/profile"
            className="rounded-editorial border border-brand-border px-6 py-3"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}