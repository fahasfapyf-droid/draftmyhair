"use client";

import { useActionState } from "react";

import {
  forgotPassword,
  type ForgotPasswordState,
} from "./actions";

const initialState: ForgotPasswordState = {
  success: false,
  message: "",
};

export default function ForgotPasswordForm() {
  const [state, formAction, pending] =
    useActionState(
      forgotPassword,
      initialState
    );

  return (
    <form
      action={formAction}
      className="space-y-6"
    >
      <div>
        <label
          htmlFor="email"
          className="mb-2 block text-sm font-medium"
        >
          Email Address
        </label>

        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="Enter your email address"
          className="w-full rounded-editorial border border-brand-border px-4 py-3"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-editorial bg-brand-ink px-4 py-3 font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending
          ? "Sending..."
          : "Send Reset Link"}
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