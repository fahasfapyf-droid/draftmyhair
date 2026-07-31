import Link from "next/link";

export function QuickActionsCard() {
  return (
    <div className="rounded-editorial border border-brand-border bg-brand-surface p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-brand-ink">
        Quick Actions
      </h2>

      <div className="mt-6 flex flex-col gap-3">
        <Link
  href="/upload?category=hairstyle"
  className="inline-flex items-center justify-center rounded-lg bg-brand-ink px-4 py-3 text-sm font-medium text-white transition hover:opacity-90"
>
  Create New Preview
</Link>

        <Link
          href="/dashboard/payments"
          className="inline-flex items-center justify-center rounded-lg border border-brand-border px-4 py-3 text-sm font-medium text-brand-ink transition hover:bg-brand-canvas"
        >
          View Payment History
        </Link>
      </div>
    </div>
  );
}