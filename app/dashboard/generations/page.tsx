import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { getUserGenerationsPage } from "@/lib/services/generation.service";

interface GenerationsPageProps {
  searchParams: Promise<{
    page?: string;
  }>;
}

export default async function GenerationsPage({
  searchParams,
}: GenerationsPageProps) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  if (session.user.role === "ADMIN") redirect("/dashboard/admin");
  if (session.user.role === "SALON") redirect("/salon/dashboard");

  const params = await searchParams;
  const requestedPage = Number.parseInt(params.page ?? "1", 10);
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const result = await getUserGenerationsPage(session.user.id, page, 12);

  return (
    <DashboardLayout
      title="Generations"
      description="View and manage your hairstyle previews."
    >
      <div className="rounded-editorial border border-brand-border bg-brand-surface p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-brand-ink">Generation History</h2>
            <p className="mt-1 text-sm text-brand-muted">
              {result.total} total generation{result.total === 1 ? "" : "s"}
            </p>
          </div>
          <Link
            href="/style-selection"
            className="rounded border border-brand-border px-4 py-2 text-sm font-medium text-brand-ink transition-colors hover:bg-brand-canvas"
          >
            New Preview
          </Link>
        </div>

        {result.generations.length === 0 ? (
          <div className="mt-6 rounded border border-dashed border-brand-border p-10 text-center">
            <p className="text-brand-muted">You haven't created any hairstyle previews yet.</p>
            <Link
              href="/style-selection"
              className="mt-5 inline-flex rounded-md bg-brand-ink px-5 py-3 text-sm font-medium text-white"
            >
              Create your first preview
            </Link>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {result.generations.map((generation) => (
              <div
                key={generation.id}
                className="rounded border border-brand-border p-4 transition-colors hover:border-brand-ink"
              >
                <div className="flex items-center justify-between gap-4">
                  <Link
                    href={`/dashboard/generations/${generation.id}`}
                    className="flex min-w-0 flex-1 items-center gap-4"
                  >
                    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded border border-brand-border bg-brand-canvas">
                      {generation.outputImageUrl ? (
                        <img
                          src={generation.outputImageUrl}
                          alt={generation.hairstyle.name}
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs text-brand-muted">
                          Pending
                        </div>
                      )}
                    </div>

                    <div className="min-w-0">
                      <p className="truncate font-medium text-brand-ink">
                        {generation.hairstyle.name}
                      </p>
                      <p className="mt-1 text-sm text-brand-muted">{generation.status}</p>
                      <p className="mt-1 text-sm text-brand-muted">
                        {generation.createdAt.toLocaleDateString()}
                      </p>
                      {generation.userFeedback ? (
                        <p className="mt-1 text-sm text-brand-ink">
                          {"★".repeat(generation.userFeedback.overallRating)}
                          {"☆".repeat(5 - generation.userFeedback.overallRating)}
                          <span className="ml-2 text-xs text-brand-muted">
                            {generation.userFeedback.overallRating}.0
                          </span>
                        </p>
                      ) : (
                        <p className="mt-1 text-xs text-brand-muted">Not rated yet</p>
                      )}
                    </div>
                  </Link>

                  <Link
                    href={`/dashboard/generations/${generation.id}`}
                    className="shrink-0 rounded border border-brand-border px-3 py-2 text-sm font-medium text-brand-ink transition-colors hover:bg-brand-canvas"
                  >
                    View
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

        {(result.hasPreviousPage || result.hasNextPage) && (
          <div className="mt-8 flex items-center justify-between border-t border-brand-border pt-6">
            {result.hasPreviousPage ? (
              <Link
                href={`/dashboard/generations?page=${result.page - 1}`}
                className="rounded border border-brand-border px-4 py-2 text-sm font-medium text-brand-ink hover:bg-brand-canvas"
              >
                ← Previous
              </Link>
            ) : (
              <span />
            )}

            <span className="text-sm text-brand-muted">Page {result.page}</span>

            {result.hasNextPage ? (
              <Link
                href={`/dashboard/generations?page=${result.page + 1}`}
                className="rounded border border-brand-border px-4 py-2 text-sm font-medium text-brand-ink hover:bg-brand-canvas"
              >
                Next →
              </Link>
            ) : (
              <span />
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
