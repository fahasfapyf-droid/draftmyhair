import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <DashboardLayout
      title="Overview"
      description="Manage your Draft My Hair account."
    >
      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-editorial border border-brand-border bg-brand-surface p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-brand-ink">
            Account
          </h2>

          <div className="mt-6 space-y-4">
            <div>
              <p className="text-sm text-brand-muted">
                Name
              </p>

              <p className="text-brand-ink font-medium">
                {session.user.name ?? "Not provided"}
              </p>
            </div>

            <div>
              <p className="text-sm text-brand-muted">
                Email
              </p>

              <p className="text-brand-ink font-medium">
                {session.user.email}
              </p>
            </div>

            <div>
              <p className="text-sm text-brand-muted">
                Role
              </p>

              <p className="text-brand-ink font-medium">
                {session.user.role}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-editorial border border-brand-border bg-brand-surface p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-brand-ink">
            Quick Actions
          </h2>

          <div className="mt-6 space-y-3">
            <p className="text-brand-muted">
              • Update your profile
            </p>

            <p className="text-brand-muted">
              • View generation history
            </p>

            <p className="text-brand-muted">
              • Manage credits
            </p>

            <p className="text-brand-muted">
              • Review payments
            </p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}