import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { AdminSidebar } from "@/components/dashboard/admin/AdminSidebar";
import { CustomerRatingSummary } from "@/components/dashboard/admin/CustomerRatingSummary";
import { prisma } from "@/lib/prisma";

const SERVICE_ORDER = [
  "HAIRSTYLE",
  "HAIR_COLOR",
  "BUZZ_CUT",
  "BALD",
  "BEARD",
  "BEARD_REMOVAL",
];

const HAIRSTYLE_CATEGORY_ORDER = [
  "BOB",
  "LOB",
  "PIXIE",
  "BIXIE",
  "LAYERS",
  "SHAG",
  "WOLF",
  "MULLET",
  "BANGS",
  "UPDO",
];

function orderedIndex(value: string, order: string[]) {
  const index = order.indexOf(value);
  return index === -1 ? order.length : index;
}

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

  const grouped = new Map<string, Map<string, Map<string, typeof generations>>>();

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

  const serviceEntries = [...grouped.entries()].sort(
    ([a], [b]) => orderedIndex(a, SERVICE_ORDER) - orderedIndex(b, SERVICE_ORDER)
  );

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
        <div className="space-y-12">
          {serviceEntries.map(([serviceType, categories]) => {
            const categoryEntries = [...categories.entries()].sort(([a], [b]) => {
              const order = serviceType === "HAIRSTYLE" ? HAIRSTYLE_CATEGORY_ORDER : [];
              const ordered = orderedIndex(a, order) - orderedIndex(b, order);
              return ordered !== 0 ? ordered : a.localeCompare(b);
            });

            const serviceGenerationCount = [...categories.values()].reduce(
              (total, styles) =>
                total + [...styles.values()].reduce((count, items) => count + items.length, 0),
              0
            );

            return (
              <section key={serviceType}>
                <div className="flex flex-wrap items-end justify-between gap-3 border-b border-brand-border pb-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-muted">Service</p>
                    <h2 className="mt-1 text-2xl font-semibold text-brand-ink">{label(serviceType)}</h2>
                  </div>
                  <span className="rounded-full border border-brand-border bg-brand-canvas px-3 py-1 text-xs text-brand-muted">
                    {serviceGenerationCount} generation{serviceGenerationCount === 1 ? "" : "s"}
                  </span>
                </div>

                <div className="mt-6 space-y-8">
                  {categoryEntries.map(([category, styles]) => {
                    const styleEntries = [...styles.entries()].sort(([a], [b]) => a.localeCompare(b));
                    const categoryGenerationCount = styleEntries.reduce(
                      (total, [, items]) => total + items.length,
                      0
                    );

                    return (
                      <section key={category}>
                        <div className="flex flex-wrap items-center gap-3">
                          <h3 className="rounded-full bg-brand-ink px-4 py-2 text-sm font-medium text-white">
                            {label(category)}
                          </h3>
                          <span className="text-xs text-brand-muted">
                            {categoryGenerationCount} generation{categoryGenerationCount === 1 ? "" : "s"}
                          </span>
                        </div>

                        <div className="mt-4 grid gap-4 lg:grid-cols-2">
                          {styleEntries.map(([style, styleGenerations]) => (
                            <details
                              key={style}
                              className="group overflow-hidden rounded-editorial border border-brand-border bg-brand-surface shadow-sm"
                            >
                              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5">
                                <div className="min-w-0">
                                  <h4 className="truncate font-medium text-brand-ink">{style}</h4>
                                  <p className="mt-1 text-xs text-brand-muted">
                                    {styleGenerations.length} generation{styleGenerations.length === 1 ? "" : "s"}
                                  </p>
                                </div>
                                <span
                                  className="shrink-0 rounded-full border border-brand-border px-2.5 py-1 text-xs text-brand-muted transition-transform group-open:rotate-180"
                                  aria-hidden="true"
                                >
                                  ↓
                                </span>
                              </summary>

                              <div className="border-t border-brand-border bg-brand-canvas p-4">
                                <div className="space-y-3">
                                  {styleGenerations.map((generation) => {
                                    const metadata = getMetadata(generation.metadata);
                                    const legacyFeedbackId =
                                      typeof metadata.feedbackId === "string" ? metadata.feedbackId : null;
                                    const userFeedback =
                                      generation.feedback ??
                                      (legacyFeedbackId ? legacyFeedbackById.get(legacyFeedbackId) : undefined);

                                    return (
                                      <div
                                        key={generation.id}
                                        className="rounded-editorial border border-brand-border bg-brand-surface p-4"
                                      >
                                        <div className="grid gap-4 sm:grid-cols-2">
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

                                        <div className="mt-4 border-t border-brand-border pt-3">
                                          <p className="text-xs font-semibold uppercase tracking-wide text-brand-muted">
                                            Customer rating
                                          </p>
                                          {userFeedback ? (
                                            <div className="mt-2 grid gap-2 sm:grid-cols-3">
                                              <div className="flex items-center justify-between gap-2">
                                                <span className="text-xs text-brand-muted">Overall</span>
                                                <Stars value={userFeedback.overallRating} />
                                              </div>
                                              <div className="flex items-center justify-between gap-2">
                                                <span className="text-xs text-brand-muted">Identity</span>
                                                <Stars value={userFeedback.identityRating} />
                                              </div>
                                              <div className="flex items-center justify-between gap-2">
                                                <span className="text-xs text-brand-muted">Realism</span>
                                                <Stars value={userFeedback.realismRating} />
                                              </div>
                                            </div>
                                          ) : (
                                            <p className="mt-2 text-xs text-brand-muted">
                                              Customer has not rated this generation yet.
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </details>
                          ))}
                        </div>
                      </section>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </DashboardLayout>
  );
}
