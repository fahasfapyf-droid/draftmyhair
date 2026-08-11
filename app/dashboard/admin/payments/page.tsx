import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { AdminSidebar } from "@/components/dashboard/admin/AdminSidebar";
import { prisma } from "@/lib/prisma";

export default async function AdminPaymentsPage() {
  const session = await auth();

  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  const payments = await prisma.payment.findMany({
    select: {
      id: true,
      amount: true,
      currency: true,
      provider: true,
      type: true,
      status: true,
      creditsPurchased: true,
      createdAt: true,
      user: { select: { email: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <DashboardLayout
      sidebar={<AdminSidebar />}
      title="Payments"
      description="Review purchases and credit activity."
    >
      <div className="overflow-x-auto rounded-editorial border border-brand-border bg-brand-surface shadow-sm">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="border-b border-brand-border text-brand-muted">
            <tr>
              <th className="px-5 py-4 font-medium">Customer</th>
              <th className="px-5 py-4 font-medium">Amount</th>
              <th className="px-5 py-4 font-medium">Provider</th>
              <th className="px-5 py-4 font-medium">Type</th>
              <th className="px-5 py-4 font-medium">Status</th>
              <th className="px-5 py-4 font-medium">Credits</th>
              <th className="px-5 py-4 font-medium">Date</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((payment) => (
              <tr key={payment.id} className="border-b border-brand-border last:border-0">
                <td className="px-5 py-4 text-brand-ink">
                  {payment.user.name || payment.user.email || "—"}
                </td>
                <td className="px-5 py-4 text-brand-ink">
                  {payment.amount.toString()} {payment.currency}
                </td>
                <td className="px-5 py-4 text-brand-muted">{payment.provider}</td>
                <td className="px-5 py-4 text-brand-muted">{payment.type}</td>
                <td className="px-5 py-4 text-brand-ink">{payment.status}</td>
                <td className="px-5 py-4 text-brand-ink">{payment.creditsPurchased}</td>
                <td className="px-5 py-4 text-brand-muted">{payment.createdAt.toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {payments.length === 0 && (
          <p className="p-6 text-sm text-brand-muted">No payments found.</p>
        )}
      </div>
    </DashboardLayout>
  );
}
