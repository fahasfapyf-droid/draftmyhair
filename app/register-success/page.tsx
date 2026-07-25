import Link from "next/link";

interface PageProps {
  searchParams: Promise<{
    email?: string;
  }>;
}

export default async function RegisterSuccessPage({
  searchParams,
}: PageProps) {
  const { email } = await searchParams;

  return (
    <main className="mx-auto flex min-h-[70vh] items-center justify-center px-6">
      <div className="w-full max-w-md rounded-editorial border border-green-200 bg-white p-10 text-center shadow-sm">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-3xl">
          ✉️
        </div>

        <h1 className="mb-3 text-3xl font-bold">
          Check your email
        </h1>

        <p className="mb-2 text-brand-muted">
          We've sent a verification email to:
        </p>

        <p className="mb-8 font-medium">
          {email}
        </p>

        <p className="mb-8 text-sm text-brand-muted">
          Verify your email before signing in.
        </p>

        <div className="space-y-3">
          <Link
            href="/login"
            className="block w-full rounded-editorial bg-brand-ink px-5 py-3 text-white"
          >
            Continue to Login
          </Link>

          <Link
            href="/"
            className="block w-full rounded-editorial border border-brand-border px-5 py-3"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </main>
  );
}