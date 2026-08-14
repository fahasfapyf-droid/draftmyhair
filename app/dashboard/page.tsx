import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { CreditBalanceCard } from "@/components/dashboard/CreditBalanceCard";
import { DashboardAnalyticsCard } from "@/components/dashboard/DashboardAnalyticsCard";
import { GenerationCard } from "@/components/dashboard/GenerationCard";
import { getUserGenerations } from "@/lib/services/generation.service";
import { QuickActionsCard } from "@/components/dashboard/QuickActionsCard";
import { PromoCodeCard } from "@/components/dashboard/PromoCodeCard";

const DASHBOARD_HISTORY_LIMIT = 6;

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user?.id) redirect("/login");
  if (session.user.role === "ADMIN") redirect("/dashboard/admin");
  if (session.user.role === "SALON") redirect("/salon/dashboard");

  const generations = await getUserGenerations(session.user.id, undefined, {
    limit: DASHBOARD_HISTORY_LIMIT,
  });

  return (
    <DashboardLayout title="Overview" description="Manage your Draft My Hair account.">
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-editorial border border-brand-border bg-brand-surface p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-brand-ink">Account</h2>
          <div className="mt-6 space-y-4">
            <div>
              <p className="text-sm text-brand-muted">Name</p>
              <p className="font-medium text-brand-ink">{session.user.name ?? "Not provided"}</p>
            </div>
            <div>
              <p className="text-sm text-brand-muted">Email</p>
              <p className="font-medium text-brand-ink">{session.user.email}</p>
            </div>
            <div>
              <p className="text-sm text-brand-muted">Role</p>
              <p className="font-medium text-brand-ink">{session.user.role}</p>
            </div>
          </div>
        </div>

        <CreditBalanceCard userId={session.user.id} />
        <PromoCodeCard />

        <DashboardAnalyticsCard userId={session.user.id} />
        <QuickActionsCard />

        <div className="rounded-editorial border border-brand-border bg-brand-surface p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-brand-ink">Quick Message</h2>
          <p className="mt-4 text-sm leading-6 text-brand-muted">
            Need help with a preview, want to report an issue, or have a feature suggestion?
          </p>
          <Link
            href="/contact"
            className="mt-6 inline-flex w-full items-center justify-center rounded-md bg-brand-ink px-4 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            Contact Us
          </Link>
        </div>

        <div className="rounded-editorial border border-brand-border bg-brand-surface p-6 shadow-sm lg:col-span-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-brand-ink">Recent Generations</h2>
              <p className="mt-1 text-sm text-brand-muted">Your six most recent previews.</p>
            </div>
            <Link
              href="/dashboard/generations"
              className="rounded border border-brand-border px-4 py-2 text-sm font-medium text-brand-ink transition-colors hover:bg-brand-canvas"
            >
              View all
            </Link>
          </div>

          {generations.length === 0 ? (
            <div className="mt-6 rounded border border-dashed border-brand-border p-6 text-center">
              <p className="text-brand-muted">You haven't created any hairstyle previews yet.</p>
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              {generations.map((generation) => (
                <GenerationCard key={generation.id} generation={generation} />
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
