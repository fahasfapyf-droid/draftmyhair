import Link from "next/link";

interface PageProps {
  searchParams: Promise<{
    email?: string;
    verificationEmailSent?: string;
  }>;
}

export default async function SalonSignupSuccessPage({ searchParams }: PageProps) {
  const { email, verificationEmailSent } = await searchParams;
  const emailSent = verificationEmailSent !== "false";

  return (
    <main className="mx-auto flex min-h-[70vh] items-center justify-center px-6">
      <div className="w-full max-w-md rounded-editorial border border-green-200 bg-white p-10 text-center shadow-sm">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-3xl">
          ✉️
        </div>

        <h1 className="mb-3 text-3xl font-bold">
          {emailSent ? "Verify your salon account" : "Salon account created"}
        </h1>

        <p className="mb-2 text-brand-muted">
          {emailSent
            ? "We've sent a verification email to:"
            : "Your salon account was created, but we could not send the verification email to:"}
        </p>

        <p className="mb-8 font-medium">{email}</p>

        <p className="mb-8 text-sm text-brand-muted">
          {emailSent
            ? "Verify your email before signing in to the salon workspace."
            : "Use the resend verification option on the login page to request a new verification email."}
        </p>

        <div className="space-y-3">
          <Link
            href="/login?callbackUrl=/salon/dashboard"
            className="block w-full rounded-editorial bg-brand-ink px-5 py-3 text-white"
          >
            Continue to Salon Login
          </Link>
          <Link
            href="/salons"
            className="block w-full rounded-editorial border border-brand-border px-5 py-3"
          >
            Back to Salon Information
          </Link>
        </div>
      </div>
    </main>
  );
}
