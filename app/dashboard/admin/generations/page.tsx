import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { AdminSidebar } from "@/components/dashboard/admin/AdminSidebar";
import { prisma } from "@/lib/prisma";

export default async function AdminGenerationsPage() {
  const session = await auth();

  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  const [generations, total, completed, failed, processing] = await Promise.all([
    prisma.generation.findMany({
      select: {
        id: true,
        status: true,
        provider: true,
        providerModel: true,
        createdAt: true,
        completedAt: true,
        processingTimeMs: true,
        user: { select: { email: true, name: true } },
        hairstyle: { select: { name: true, serviceType: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.generation.count(),
    prisma.generation.count({ where: { status: "COMPLETED" } }),
    prisma.generation.count({ where: { status: "FAILED" } }),
    prisma.generation.count({ where: { status: "PROCESSING" } }),
  ]);

  const stats = [
    { label: "Total generations", value: total },
    { label: "Completed", value: completed },
    { label: "Failed", value: failed },
    { label: "Processing", value: processing },
  ];

  return (
    <DashboardLayout
      sidebar={<AdminSidebar />}
      title="AI Generations"
      description="Monitor AI hairstyle generations."
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-editorial border border-brand-border bg-brand-surface p-5 shadow-sm"
          >
            <p className="text-sm text-brand-muted">{stat.label}</p>
            <p className="mt-2 text-3xl font-semibold text-brand-ink">
              {stat.value.toLocaleString()}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-6 overflow-x-auto rounded-editorial border border-brand-border bg-brand-surface shadow-sm">
        <table className="w-full min-w-[1000px] text-left text-sm">
          <thead className="border-b border-brand-border text-brand-muted">
            <tr>
              <th className="px-5 py-4 font-medium">Customer</th>
              <th className="px-5 py-4 font-medium">Style</th>
              <th className="px-5 py-4 font-medium">Service</th>
              <th className="px-5 py-4 font-medium">Status</th>
              <th className="px-5 py-4 font-medium">Provider</th>
              <th className="px-5 py-4 font-medium">Created</th>
              <th className="px-5 py-4 font-medium">Processing</th>
            </tr>
          </thead>
          <tbody>
            {generations.map((generation) => (
              <tr key={generation.id} className="border-b border-brand-border last:border-0">
                <td className="px-5 py-4 text-brand-ink">
                  {generation.user.name || generation.user.email || "—"}
                </td>
                <td className="px-5 py-4 text-brand-ink">{generation.hairstyle.name}</td>
                <td className="px-5 py-4 text-brand-muted">{generation.hairstyle.serviceType}</td>
                <td className="px-5 py-4 text-brand-ink">{generation.status}</td>
                <td className="px-5 py-4 text-brand-muted">
                  {generation.providerModel || generation.provider}
                </td>
                <td className="px-5 py-4 text-brand-muted">{generation.createdAt.toLocaleDateString()}</td>
                <td className="px-5 py-4 text-brand-muted">
                  {generation.processingTimeMs != null
                    ? `${generation.processingTimeMs} ms`
                    : generation.completedAt
                      ? "Completed"
                      : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {generations.length === 0 && (
          <p className="p-6 text-sm text-brand-muted">No generations found.</p>
        )}
      </div>
    </DashboardLayout>
  );
}
