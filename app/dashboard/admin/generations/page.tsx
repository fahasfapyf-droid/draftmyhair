import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { AdminSidebar } from "@/components/dashboard/admin/AdminSidebar";
import { GenerationQaForm } from "@/components/dashboard/admin/GenerationQaForm";
import { prisma } from "@/lib/prisma";

function getMetadata(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function rating(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 5
    ? value
    : undefined;
}

function Stars({ value }: { value: number }) {
  return (
    <span
      className="inline-flex items-center gap-1 text-sm text-brand-ink"
      aria-label={`${value} out of 5 stars`}
    >
      <span aria-hidden="true">{"★".repeat(value)}{"☆".repeat(5 - value)}</span>
      <span className="text-xs text-brand-muted">{value}.0</span>
    </span>
  );
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
      metadata: true,
      user: { select: { email: true, name: true } },
      hairstyle: { select: { name: true, serviceType: true } },
      feedback: {
        select: {
          id: true,
          userId: true,
          overallRating: true,
          identityRating: true,
          realismRating: true,
          decisionConfidence: true,
          issues: true,
          comment: true,
          createdAt: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  // Legacy feedback rows created before the direct generation relation are still
  // recoverable through metadata.feedbackId. New rows use generation.feedback.
  const feedbackIds = generations
    .filter((generation) => !generation.feedback)
    .map((generation) => {
      const metadata = getMetadata(generation.metadata);
      return typeof metadata.feedbackId === "string" ? metadata.feedbackId : null;
    })
    .filter((id): id is string => Boolean(id));

  const legacyFeedbackRows = feedbackIds.length
    ? await prisma.feedback.findMany({
        where: { id: { in: feedbackIds } },
        select: {
          id: true,
          userId: true,
          overallRating: true,
          identityRating: true,
          realismRating: true,
          decisionConfidence: true,
          issues: true,
          comment: true,
          createdAt: true,
        },
      })
    : [];

  const legacyFeedbackById = new Map(legacyFeedbackRows.map((feedback) => [feedback.id, feedback]));

  return (
    <DashboardLayout
      sidebar={<AdminSidebar />}
      title="AI Generations"
      description="Monitor AI hairstyle generations and internal quality."
    >
      <div className="space-y-4">
        {generations.map((generation) => {
          const metadata = getMetadata(generation.metadata);
          const rawQa = metadata.qa;
          const qa = rawQa && typeof rawQa === "object" && !Array.isArray(rawQa)
            ? (rawQa as Record<string, unknown>)
            : undefined;
          const legacyFeedbackId = typeof metadata.feedbackId === "string" ? metadata.feedbackId : null;
          const userFeedback = generation.feedback ?? (legacyFeedbackId ? legacyFeedbackById.get(legacyFeedbackId) : undefined);

          return (
            <div
              key={generation.id}
              className="rounded-editorial border border-brand-border bg-brand-surface p-5 shadow-sm"
            >
              <div className="grid gap-4 lg:grid-cols-7">
                <div>
                  <p className="text-xs text-brand-muted">Customer</p>
                  <p className="mt-1 text-sm font-medium text-brand-ink">
                    {generation.user.name || generation.user.email || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-brand-muted">Style</p>
                  <p className="mt-1 text-sm font-medium text-brand-ink">{generation.hairstyle.name}</p>
                </div>
                <div>
                  <p className="text-xs text-brand-muted">Service</p>
                  <p className="mt-1 text-sm text-brand-muted">{generation.hairstyle.serviceType}</p>
                </div>
                <div>
                  <p className="text-xs text-brand-muted">Status</p>
                  <p className="mt-1 text-sm text-brand-ink">{generation.status}</p>
                </div>
                <div>
                  <p className="text-xs text-brand-muted">Provider</p>
                  <p className="mt-1 text-sm text-brand-muted">
                    {generation.providerModel || generation.provider}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-brand-muted">Created</p>
                  <p className="mt-1 text-sm text-brand-muted">
                    {generation.createdAt.toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-brand-muted">Processing</p>
                  <p className="mt-1 text-sm text-brand-muted">
                    {generation.processingTimeMs != null
                      ? `${generation.processingTimeMs} ms`
                      : generation.completedAt
                        ? "Completed"
                        : "—"}
                  </p>
                </div>
              </div>

              {generation.status === "COMPLETED" && (
                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <div className="rounded-editorial border border-brand-border bg-brand-canvas p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-brand-muted">
                      Customer Feedback
                    </p>
                    {userFeedback ? (
                      <div className="mt-3 space-y-3">
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-sm text-brand-muted">Overall satisfaction</span>
                          <Stars value={userFeedback.overallRating} />
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-sm text-brand-muted">Identity</span>
                          <Stars value={userFeedback.identityRating} />
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-sm text-brand-muted">Realism</span>
                          <Stars value={userFeedback.realismRating} />
                        </div>
                        {userFeedback.comment && (
                          <p className="border-t border-brand-border pt-3 text-sm leading-relaxed text-brand-muted">
                            “{userFeedback.comment}”
                          </p>
                        )}
                        <p className="text-xs text-brand-muted">
                          Submitted {userFeedback.createdAt.toLocaleDateString()}
                        </p>
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-brand-muted">Customer has not rated this generation yet.</p>
                    )}
                  </div>

                  <GenerationQaForm
                    generationId={generation.id}
                    qa={{
                      overall: rating(qa?.overall),
                      identity: rating(qa?.identity),
                      integration: rating(qa?.integration),
                      realism: rating(qa?.realism),
                      notes: typeof qa?.notes === "string" ? qa.notes : null,
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}

        {generations.length === 0 && (
          <p className="rounded-editorial border border-brand-border bg-brand-surface p-6 text-sm text-brand-muted">
            No generations found.
          </p>
        )}
      </div>
    </DashboardLayout>
  );
}
