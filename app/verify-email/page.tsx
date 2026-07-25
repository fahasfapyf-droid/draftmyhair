import { prisma } from "@/lib/prisma";
import Link from "next/link";

interface PageProps {
  searchParams: Promise<{
    token?: string;
  }>;
}

export default async function VerifyEmailPage({
  searchParams,
}: PageProps) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <main className="mx-auto flex min-h-[70vh] max-w-xl items-center justify-center px-6">
        <div className="w-full rounded-editorial border border-red-300 bg-red-50 p-8 text-center">
          <h1 className="mb-4 text-2xl font-semibold">
            Invalid Verification Link
          </h1>

          <p className="text-brand-muted">
  This verification link is invalid.
  Please request a new verification email.
</p>
        </div>
      </main>
    );
  }

  const verificationToken =
    await prisma.verificationToken.findUnique({
      where: {
        token,
      },
    });

  if (
    !verificationToken ||
    verificationToken.expires < new Date()
  ) {
    return (
      <main className="mx-auto flex min-h-[70vh] max-w-xl items-center justify-center px-6">
        <div className="w-full rounded-editorial border border-red-300 bg-red-50 p-8 text-center">
          <h1 className="mb-4 text-2xl font-semibold">
            Verification Link Expired
          </h1>

          <p className="text-brand-muted">
  This verification link is no longer valid.
  Please sign in and request a new verification email.
</p>
        </div>
      </main>
    );
  }

  await prisma.user.update({
    where: {
      email: verificationToken.identifier,
    },
    data: {
      emailVerified: new Date(),
    },
  });

  await prisma.verificationToken.delete({
    where: {
      token,
    },
  });

  return (
  <main className="mx-auto flex min-h-[70vh] items-center justify-center px-6">
    <div className="w-full max-w-md rounded-editorial border border-green-200 bg-white p-10 text-center shadow-sm">
      <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-3xl">
        ✓
      </div>

      <h1 className="mb-3 text-3xl font-bold text-brand-ink">
        Email Verified
      </h1>

      <p className="mb-8 text-brand-muted">
        Your email has been successfully verified.
        You can now sign in to your Draft My Hair account.
      </p>

      <div className="space-y-3">
        <Link
          href="/login"
          className="block w-full rounded-editorial bg-brand-ink px-5 py-3 text-center font-medium text-white transition-opacity hover:opacity-90"
        >
          Continue to Login
        </Link>

        <Link
          href="/"
          className="block w-full rounded-editorial border border-brand-border px-5 py-3 text-center font-medium transition-colors hover:bg-brand-background"
        >
          Back to Home
        </Link>
      </div>
    </div>
  </main>
);
}