import Link from "next/link";

import ForgotPasswordForm from "./ForgotPasswordForm";

export default function ForgotPasswordPage() {
  return (
    <main className="mx-auto max-w-md px-6 py-10">
      <h1 className="mb-2 text-3xl font-bold">
        Forgot Password
      </h1>

      <p className="mb-8 text-brand-muted">
        Enter your email address and we'll send you a password reset link if an
        account exists.
      </p>

      <ForgotPasswordForm />

      <div className="mt-8 text-center">
        <Link
          href="/login"
          className="text-sm font-medium text-brand-ink transition-opacity hover:opacity-70"
        >
          Back to Sign In
        </Link>
      </div>
    </main>
  );
}