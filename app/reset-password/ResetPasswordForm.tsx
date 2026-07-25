"use client";

import { useActionState } from "react";

import {
  resetPassword,
  type ResetPasswordState,
} from "./actions";

const initialState: ResetPasswordState = {
  success: false,
  message: "",
};

interface ResetPasswordFormProps {
  token: string;
}

export default function ResetPasswordForm({
  token,
}: ResetPasswordFormProps) {
  const [state, formAction, pending] =
    useActionState(
      resetPassword,
      initialState
    );

  return (
    <form
      action={formAction}
      className="space-y-6"
    >
      <input
        type="hidden"
        name="token"
        value={token}
      />

      <div>
        <label
          htmlFor="password"
          className="mb-2 block text-sm font-medium"
        >
          New Password
        </label>

        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="new-password"
          placeholder="Enter your new password"
          className="w-full rounded-editorial border border-brand-border px-4 py-3"
        />
      </div>

      <div>
        <label
          htmlFor="confirmPassword"
          className="mb-2 block text-sm font-medium"
        >
          Confirm Password
        </label>

        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          required
          autoComplete="new-password"
          placeholder="Confirm your new password"
          className="w-full rounded-editorial border border-brand-border px-4 py-3"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-editorial bg-brand-ink px-4 py-3 font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending
          ? "Updating..."
          : "Update Password"}
      </button>

      {state.message && (
        <div
          className={`rounded-editorial px-4 py-3 text-sm ${
            state.success
              ? "border border-green-300 bg-green-50 text-green-700"
              : "border border-red-300 bg-red-50 text-red-700"
          }`}
        >
          {state.message}
        </div>
      )}
    </form>
  );
}