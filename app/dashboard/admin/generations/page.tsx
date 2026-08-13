import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { AdminSidebar } from "@/components/dashboard/admin/AdminSidebar";
import { CustomerRatingSummary } from "@/components/dashboard/admin/CustomerRatingSummary";
import { prisma } from "@/lib/prisma";

function getMetadata(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function label(value: string | null | undefined) {
  if (!value) return "Other";
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
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
      hairstyle: { select: { name: true, category: true, serviceType: true } },
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

  const grouped = new Map<
    string,
    Map<string, Map<string, typeof generations>>
  >();

  for (const generation of generations) {
    const service = generation.hairstyle.serviceType;
    const category = generation.hairstyle.category ?? "OTHER";
    const style = generation.hairstyle.name;

    const serviceGroup = grouped.get(service) ?? new Map();
    const categoryGroup = serviceGroup.get(category) ?? new Map();
    const styleGroup = categoryGroup.get(style) ?? [];

    styleGroup.push(generation);
    categoryGroup.set(style, styleGroup);
    serviceGroup.set(category, categoryGroup);
    grouped.set(service, serviceGroup);
  }

  return (
    <DashboardLayout
      sidebar={<AdminSidebar />}
      title="AI Generations"
      description="Review generations and customer feedback organized by service, category, and hairstyle."
    >
      <CustomerRatingSummary />

      {generations.length === 0 ? (
        <p className="rounded-editorial border border-brand-border bg-brand-surface p-6 text-sm text-brand-muted">
          No generations found.
        </p>
      ) : (
        <div className="space-y-10">
          {[...grouped.entries()].map(([serviceType, categories]) => (
            <section key={serviceType}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-muted">Service</p>
                  <h2 className="mt-1 text-xl font-semibold text-brand-ink">{label(serviceType)}</h2>
                </div>
                <span className="rounded-full border border-brand-border bg-brand-canvas px-3 py-1 text-xs text-brand-muted">
                  {[...categories.values()].reduce((total, styles) => total + [...styles.values()].reduce((count, items) => count + items.length, 0), 0)} generations
                </span>
              </div>

              <div className="mt-5 space-y-6">
                {[...categories.entries()].map(([category, styles]) => (
                  <div key={category}>
                    <div className="mb-3 flex flex-wrap gap-2">
                      <span className="rounded-full bg-brand-ink px-3 py-1.5 text-xs font-medium text-white">
                        {label(category)}
                      </span>
                      {[...styles.keys()].sort((a, b) => a.localeCompare(b)).map((style) => (
                        <span
                          key={style}
                          className="rounded-full border border-brand-border bg-brand-surface px-3 py-1.5 text-xs text-brand-ink"
                        >
                          {style}
                        </span>
                      ))}
                    </div>

                    <div className="space-y-4">
                      {[...styles.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([style, styleGenerations]) => (
                        <details
                          key={style}
                          open={serviceType === "HAIRSTYLE" && category === "BOB"}
                          className="group rounded-editorial border border-brand-border bg-brand-surface shadow-sm"
                        >
                          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-4">
                            <div>
                              <h3 className="font-medium text-brand-ink">{style}</h3>
                              <p className="mt-1 text-xs text-brand-muted">
                                {styleGenerations.length} generation{styleGenerations.length === 1 ? "" : "s"}
                              </p>
                            </div>
                            <span className="text-sm text-brand-muted transition-transform group-open:rotate-180" aria-hidden="true">⌄</span>
                          </summary>

                          <div className="border-t border-brand-border p-4">
                            <div className="space-y-3">
                              {styleGenerations.map((generation) => {
                                const metadata = getMetadata(generation.metadata);
                                const legacyFeedbackId = typeof metadata.feedbackId === "string" ? metadata.feedbackId : null;
                                const userFeedback = generation.feedback ?? (legacyFeedbackId ? legacyFeedbackById.get(legacyFeedbackId) : undefined);

                                return (
                                  <div
                                    key={generation.id}
                                    className="rounded-editorial border border-brand-border bg-brand-canvas p-4"
                                  >
                                    <div className="grid gap-4 lg:grid-cols-7">
                                      <div>
                                        <p className="text-xs text-brand-muted">Customer</p>
                                        <p className="mt-1 text-sm font-medium text-brand-ink">
                                          {generation.user.name || generation.user.email || "—"}
                                        </p>
                                      </div>
                                      <div>
                                        <p className="text-xs text-brand-muted">Status</p>
                                        <p className="mt-1 text-sm text-brand-ink">{generation.status}</p>
                                      </div>
                                      <div>
                                        <p className="text-xs text-brand-muted">Provider</p>
                                        <p className="mt-1 text-sm text-brand-muted">{generation.providerModel || generation.provider}</p>
                                      </div>
                                      <div>
                                        <p className="text-xs text-brand-muted">Created</p>
                                        <p className="mt-1 text-sm text-brand-muted">{generation.createdAt.toLocaleDateString()}</p>
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
                                      <div className="lg:col-span-2">
                                        <p className="text-xs text-brand-muted">Customer rating</p>
                                        <div className="mt-1">
                                          {userFeedback ? (
                                            <Stars value={userFeedback.overallRating} />
                                          ) : (
                                            <span className="text-xs text-brand-muted">Not rated</span>
                                          )}
                                        </div>
                                      </div>
                                    </div>

                                    {generation.status === "COMPLETED" && (
                                      <div className="mt-4 border-t border-brand-border pt-3">
                                        {userFeedback ? (
                                          <div className="grid gap-3 md:grid-cols-3">
                                            <div className="flex items-center justify-between gap-3">
                                              <span className="text-xs text-brand-muted">Overall</span>
                                              <Stars value={userFeedback.overallRating} />
                                            </div>
                                            <div className="flex items-center justify-between gap-3">
                                              <span className="text-xs text-brand-muted">Identity</span>
                                              <Stars value={userFeedback.identityRating} />
                                            </div>
                                            <div className="flex items-center justify-between gap-3">
                                              <span className="text-xs text-brand-muted">Realism</span>
                                              <Stars value={userFeedback.realismRating} />
                                            </div>
                                          </div>
                                        ) : (
                                          <p className="text-xs text-brand-muted">Customer has not rated this generation yet.</p>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </details>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}
