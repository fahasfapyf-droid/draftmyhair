import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { getUserGenerations } from "@/lib/services/generation.service";

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const generations = await getUserGenerations(session.user.id);

  return (
    <DashboardLayout
      title="Overview"
      description="Manage your Draft My Hair account."
    >
      <div className="grid gap-6 md:grid-cols-2">
        {/* Account */}
        <div className="rounded-editorial border border-brand-border bg-brand-surface p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-brand-ink">
            Account
          </h2>

          <div className="mt-6 space-y-4">
            <div>
              <p className="text-sm text-brand-muted">
                Name
              </p>

              <p className="font-medium text-brand-ink">
                {session.user.name ?? "Not provided"}
              </p>
            </div>

            <div>
              <p className="text-sm text-brand-muted">
                Email
              </p>

              <p className="font-medium text-brand-ink">
                {session.user.email}
              </p>
            </div>

            <div>
              <p className="text-sm text-brand-muted">
                Role
              </p>

              <p className="font-medium text-brand-ink">
                {session.user.role}
              </p>
            </div>
          </div>
        </div>

        {/* Generation History */}
        <div className="rounded-editorial border border-brand-border bg-brand-surface p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-brand-ink">
            Generation History
          </h2>

          {generations.length === 0 ? (
            <div className="mt-6 rounded border border-dashed border-brand-border p-6 text-center">
              <p className="text-brand-muted">
                You haven't created any hairstyle previews yet.
              </p>
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              {generations.map((generation) => (
                <Link
                  key={generation.id}
                  href={`/dashboard/generations/${generation.id}`}
                  className="block rounded border border-brand-border p-4 transition-colors hover:border-brand-ink"
                >
                  <div className="flex items-center justify-between gap-4">
  <div className="flex items-center gap-4">
    <div className="relative h-16 w-16 overflow-hidden rounded border border-brand-border bg-brand-canvas">
      {generation.outputImageUrl ? (
        <img
  src={generation.outputImageUrl}
  alt={generation.hairstyle.name}
  className="h-full w-full object-cover"
/>
      ) : (
        <div className="flex h-full w-full items-center justify-center text-xs text-brand-muted">
          Pending
        </div>
      )}
    </div>

    <div>
      <p className="font-medium text-brand-ink">
        {generation.hairstyle.name}
      </p>

      <p className="mt-1 text-sm text-brand-muted">
        {generation.status}
      </p>
    </div>
  </div>

  <div className="text-right">
    <p className="text-sm text-brand-muted">
      {generation.createdAt.toLocaleDateString()}
    </p>

    <p className="mt-1 text-sm font-medium text-brand-ink">
      View →
    </p>
  </div>
</div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
