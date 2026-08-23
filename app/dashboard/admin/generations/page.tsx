import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { AdminSidebar } from "@/components/dashboard/admin/AdminSidebar";
import { prisma } from "@/lib/prisma";

function getProviderAttempts(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return 0;
  }

  const value = (metadata as Record<string, unknown>).providerAttempts;
  return typeof value === "number" && Number.isInteger(value) && value >= 0
    ? value
    : 0;
}

export default async function AdminGenerationsPage() {
  const session = await auth();

  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  const generations = await prisma.generation.findMany({
    select: {
      id: true,
      status: true,
      provider: true,
      providerModel: true,
      metadata: true,
      createdAt: true,
      completedAt: true,
      processingTimeMs: true,
      user: { select: { email: true, name: true } },
      hairstyle: { select: { name: true, serviceType: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <DashboardLayout
      sidebar={<AdminSidebar />}
      title="AI Generations"
      description="Monitor AI hairstyle generations."
    >
      <div className="overflow-x-auto rounded-editorial border border-brand-border bg-brand-surface shadow-sm">
        <table className="w-full min-w-[1100px] text-left text-sm">
          <thead className="border-b border-brand-border text-brand-muted">
            <tr>
              <th className="px-5 py-4 font-medium">Customer</th>
              <th className="px-5 py-4 font-medium">Style</th>
              <th className="px-5 py-4 font-medium">Service</th>
              <th className="px-5 py-4 font-medium">Status</th>
              <th className="px-5 py-4 font-medium">Provider</th>
              <th className="px-5 py-4 font-medium">Attempts</th>
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
                <td className="px-5 py-4 text-brand-muted">
                  {getProviderAttempts(generation.metadata)}
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
