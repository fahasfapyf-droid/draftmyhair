import Link from "next/link";

import { getBalance } from "@/lib/services/credit.service";

interface CreditBalanceCardProps {
  userId: string;
}

export async function CreditBalanceCard({
  userId,
}: CreditBalanceCardProps) {
  const balance = await getBalance(userId);

  return (
    <div className="rounded-editorial border border-brand-border bg-brand-surface p-6 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-brand-muted">
            Available Credits
          </p>

          <h2 className="mt-2 text-4xl font-bold text-brand-ink">
            {balance}
          </h2>

          <p className="mt-2 text-sm text-brand-muted">
            Each AI generation uses one credit.
          </p>
        </div>
      </div>

      <div className="mt-6">
        <Link
          href="/dashboard/payments"
          className="inline-flex items-center rounded-lg bg-brand-primary px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
        >
          Buy Credits
        </Link>
      </div>
    </div>
  );
}