import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { CreditBalanceCard } from "@/components/dashboard/CreditBalanceCard";
import { DashboardAnalyticsCard } from "@/components/dashboard/DashboardAnalyticsCard";
import { GenerationCard } from "@/components/dashboard/GenerationCard";
import { getUserGenerations } from "@/lib/services/generation.service";
import { QuickActionsCard } from "@/components/dashboard/QuickActionsCard";

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
      <div className="grid gap-6 lg:grid-cols-3">
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

        {/* Credit Balance */}
        <CreditBalanceCard userId={session.user.id} />

        {/* Dashboard Analytics */}
        <QuickActionsCard />

<DashboardAnalyticsCard
  userId={session.user.id}
/>

        {/* Generation History */}
        <div className="rounded-editorial border border-brand-border bg-brand-surface p-6 shadow-sm lg:col-span-3">
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
                <GenerationCard
                  key={generation.id}
                  generation={generation}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}