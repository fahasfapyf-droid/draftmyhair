import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { getPaymentHistory } from "@/lib/services/payment.service";

export default async function PaymentsPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const transactions = await getPaymentHistory(session.user.id);

  return (
    <DashboardLayout
      title="Payment History"
      description="View your wallet activity and credit transactions."
    >
      <div className="rounded-editorial border border-brand-border bg-brand-surface shadow-sm">
        {transactions.length === 0 ? (
          <div className="p-12 text-center">
            <h2 className="text-lg font-semibold text-brand-ink">
              No transactions yet
            </h2>

            <p className="mt-2 text-brand-muted">
              Your wallet activity will appear here once you receive or spend
              credits.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="border-b border-brand-border bg-brand-background">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-brand-ink">
                    Date
                  </th>

                  <th className="px-6 py-4 text-left text-sm font-semibold text-brand-ink">
                    Type
                  </th>

                  <th className="px-6 py-4 text-left text-sm font-semibold text-brand-ink">
                    Description
                  </th>

                  <th className="px-6 py-4 text-right text-sm font-semibold text-brand-ink">
                    Amount
                  </th>

                  <th className="px-6 py-4 text-right text-sm font-semibold text-brand-ink">
                    Balance
                  </th>
                </tr>
              </thead>

              <tbody>
                {transactions.map((transaction) => (
                  <tr
                    key={transaction.id}
                    className="border-b border-brand-border last:border-0"
                  >
                    <td className="px-6 py-4 text-sm text-brand-muted">
                      {transaction.createdAt.toLocaleDateString()}
                    </td>

                    <td className="px-6 py-4 text-sm font-medium text-brand-ink">
                      {transaction.type}
                    </td>

                    <td className="px-6 py-4 text-sm text-brand-muted">
                      {transaction.description ?? "—"}
                    </td>

                    <td
                      className={`px-6 py-4 text-right text-sm font-semibold ${
                        transaction.amount >= 0
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      {transaction.amount > 0 ? "+" : ""}
                      {transaction.amount}
                    </td>

                    <td className="px-6 py-4 text-right text-sm font-medium text-brand-ink">
                      {transaction.balanceAfter}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}