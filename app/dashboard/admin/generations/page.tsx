import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { AdminSidebar } from "@/components/dashboard/admin/AdminSidebar";
import { prisma } from "@/lib/prisma";

type FailureCategory = {
  label: string;
  count: number;
};

const FAILURE_CATEGORY_ORDER = [
  "Safety / policy refusal",
  "Rate limit (429)",
  "Provider 5xx error",
  "Timeout / deadline",
  "Network / connection",
  "No image returned",
  "Invalid image result",
  "Storage / persistence",
  "Validation / configuration",
  "Other / unknown",
] as const;

type FailureCategoryLabel = (typeof FAILURE_CATEGORY_ORDER)[number];

function classifyFailure(message: string | null): FailureCategoryLabel {
  const value = (message ?? "").toLowerCase();

  if (
    value.includes("safety") ||
    value.includes("policy") ||
    value.includes("blocked") ||
    value.includes("responsible ai") ||
    value.includes("content filter") ||
    value.includes("prohibited")
  ) {
    return "Safety / policy refusal";
  }

  if (value.includes("429") || value.includes("rate limit") || value.includes("too many requests")) {
    return "Rate limit (429)";
  }

  if (
    value.includes("500") ||
    value.includes("502") ||
    value.includes("503") ||
    value.includes("504") ||
    value.includes("internal server error") ||
    value.includes("service unavailable")
  ) {
    return "Provider 5xx error";
  }

  if (value.includes("timeout") || value.includes("timed out") || value.includes("deadline")) {
    return "Timeout / deadline";
  }

  if (
    value.includes("network") ||
    value.includes("connection") ||
    value.includes("econn") ||
    value.includes("socket") ||
    value.includes("unavailable")
  ) {
    return "Network / connection";
  }

  if (value.includes("returned no image") || value.includes("no image")) {
    return "No image returned";
  }

  if (
    value.includes("invalid dimensions") ||
    value.includes("invalid image") ||
    value.includes("incomplete image data")
  ) {
    return "Invalid image result";
  }

  if (
    value.includes("storage") ||
    value.includes("upload failed") ||
    value.includes("persist") ||
    value.includes("record creation failed")
  ) {
    return "Storage / persistence";
  }

  if (
    value.includes("validation") ||
    value.includes("required") ||
    value.includes("not found") ||
    value.includes("missing environment") ||
    value.includes("invalid json") ||
    value.includes("unsupported image")
  ) {
    return "Validation / configuration";
  }

  return "Other / unknown";
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
      createdAt: true,
      completedAt: true,
      processingTimeMs: true,
      user: { select: { email: true, name: true } },
      hairstyle: { select: { name: true, serviceType: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const failedRows = await prisma.generation.findMany({
    where: { status: "FAILED" },
    select: { errorMessage: true },
  });

  const failureCounts = new Map<FailureCategoryLabel, number>();
  for (const label of FAILURE_CATEGORY_ORDER) {
    failureCounts.set(label, 0);
  }

  for (const row of failedRows) {
    const category = classifyFailure(row.errorMessage);
    failureCounts.set(category, (failureCounts.get(category) ?? 0) + 1);
  }

  const failureAnalysis: FailureCategory[] = FAILURE_CATEGORY_ORDER
    .map((label) => ({ label, count: failureCounts.get(label) ?? 0 }))
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count);

  const totalFailed = failedRows.length;
  const largestFailure = failureAnalysis[0];

  return (
    <DashboardLayout
      sidebar={<AdminSidebar />}
      title="AI Generations"
      description="Monitor AI hairstyle generations and investigate failures."
    >
      <div className="space-y-6">
        <section className="rounded-editorial border border-brand-border bg-brand-surface p-6 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-brand-ink">Failure Analysis</h2>
              <p className="mt-1 text-sm text-brand-muted">
                Categorized from the recorded generation error messages. This identifies where failures occur; it does not by itself prove that a failed request was billed by Vertex.
              </p>
            </div>
            <div className="text-sm text-brand-muted">
              Failed generations: <span className="font-semibold text-brand-ink">{totalFailed.toLocaleString()}</span>
            </div>
          </div>

          {failureAnalysis.length > 0 ? (
            <div className="mt-5 overflow-x-auto rounded-lg border border-brand-border">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead className="border-b border-brand-border text-brand-muted">
                  <tr>
                    <th className="px-4 py-3 font-medium">Failure category</th>
                    <th className="px-4 py-3 text-right font-medium">Count</th>
                    <th className="px-4 py-3 text-right font-medium">Share</th>
                  </tr>
                </thead>
                <tbody>
                  {failureAnalysis.map((item) => (
                    <tr key={item.label} className="border-b border-brand-border last:border-0">
                      <td className="px-4 py-3 font-medium text-brand-ink">{item.label}</td>
                      <td className="px-4 py-3 text-right text-brand-ink">{item.count.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-brand-muted">
                        {totalFailed > 0 ? `${((item.count / totalFailed) * 100).toFixed(1)}%` : "0.0%"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-5 text-sm text-brand-muted">No failed generations found.</p>
          )}

          {largestFailure ? (
            <div className="mt-4 rounded-lg border border-brand-border px-4 py-3 text-sm">
              <span className="text-brand-muted">Largest failure class:</span>{" "}
              <span className="font-semibold text-brand-ink">{largestFailure.label}</span>{" "}
              <span className="text-brand-muted">({largestFailure.count.toLocaleString()} failures)</span>
            </div>
          ) : null}
        </section>

        <section className="overflow-x-auto rounded-editorial border border-brand-border bg-brand-surface shadow-sm">
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
        </section>
      </div>
    </DashboardLayout>
  );
}
