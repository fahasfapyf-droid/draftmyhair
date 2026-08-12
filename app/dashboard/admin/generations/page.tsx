import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { AdminSidebar } from "@/components/dashboard/admin/AdminSidebar";
import { GenerationQaForm } from "@/components/dashboard/admin/GenerationQaForm";
import { prisma } from "@/lib/prisma";

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
      createdAt: true,
      completedAt: true,
      processingTimeMs: true,
      metadata: true,
      user: { select: { email: true, name: true } },
      hairstyle: { select: { name: true, serviceType: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <DashboardLayout sidebar={<AdminSidebar />} title="AI Generations" description="Monitor AI hairstyle generations and internal quality." >
      <div className="space-y-4">
        {generations.map((generation) => {
          const metadata = generation.metadata && typeof generation.metadata === "object" && !Array.isArray(generation.metadata)
            ? generation.metadata as Record<string, unknown>
            : {};
          const rawQa = metadata.qa;
          const qa = rawQa && typeof rawQa === "object" && !Array.isArray(rawQa) ? rawQa as Record<string, unknown> : undefined;
          const numberOrUndefined = (value: unknown) => typeof value === "number" ? value : undefined;

          return (
            <div key={generation.id} className="rounded-editorial border border-brand-border bg-brand-surface p-5 shadow-sm">
              <div className="grid gap-4 lg:grid-cols-7">
                <div><p className="text-xs text-brand-muted">Customer</p><p className="mt-1 text-sm font-medium text-brand-ink">{generation.user.name || generation.user.email || "—"}</p></div>
                <div><p className="text-xs text-brand-muted">Style</p><p className="mt-1 text-sm font-medium text-brand-ink">{generation.hairstyle.name}</p></div>
                <div><p className="text-xs text-brand-muted">Service</p><p className="mt-1 text-sm text-brand-muted">{generation.hairstyle.serviceType}</p></div>
                <div><p className="text-xs text-brand-muted">Status</p><p className="mt-1 text-sm text-brand-ink">{generation.status}</p></div>
                <div><p className="text-xs text-brand-muted">Provider</p><p className="mt-1 text-sm text-brand-muted">{generation.providerModel || generation.provider}</p></div>
                <div><p className="text-xs text-brand-muted">Created</p><p className="mt-1 text-sm text-brand-muted">{generation.createdAt.toLocaleDateString()}</p></div>
                <div><p className="text-xs text-brand-muted">Processing</p><p className="mt-1 text-sm text-brand-muted">{generation.processingTimeMs != null ? `${generation.processingTimeMs} ms` : generation.completedAt ? "Completed" : "—"}</p></div>
              </div>
              {generation.status === "COMPLETED" && (
                <GenerationQaForm generationId={generation.id} qa={{ overall: numberOrUndefined(qa?.overall), identity: numberOrUndefined(qa?.identity), integration: numberOrUndefined(qa?.integration), realism: numberOrUndefined(qa?.realism), notes: typeof qa?.notes === "string" ? qa.notes : null }} />
              )}
            </div>
          );
        })}
        {generations.length === 0 && <p className="rounded-editorial border border-brand-border bg-brand-surface p-6 text-sm text-brand-muted">No generations found.</p>}
      </div>
    </DashboardLayout>
  );
}
