"use client";

interface DashboardErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function DashboardError({
  error,
  reset,
}: DashboardErrorProps) {
  console.error(error);

  return (
    <main className="mx-auto flex min-h-[50vh] max-w-3xl items-center justify-center px-6 py-12">
      <div className="w-full rounded-editorial border border-brand-border bg-brand-surface p-8 text-center shadow-sm">
        <h1 className="text-2xl font-semibold text-brand-ink">
          Something went wrong
        </h1>

        <p className="mt-3 text-brand-muted">
          We couldn't load your dashboard. Please try again.
        </p>

        <button
          type="button"
          onClick={reset}
          className="mt-6 rounded bg-brand-ink px-5 py-2 text-brand-canvas transition-opacity hover:opacity-90"
        >
          Try Again
        </button>
      </div>
    </main>
  );
}