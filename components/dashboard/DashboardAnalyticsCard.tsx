import { getDashboardAnalytics } from "@/lib/services/dashboard.service";

interface DashboardAnalyticsCardProps {
  userId: string;
}

export async function DashboardAnalyticsCard({
  userId,
}: DashboardAnalyticsCardProps) {
  const analytics = await getDashboardAnalytics(userId);

  return (
    <div className="rounded-editorial border border-brand-border bg-brand-surface p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-brand-ink">
        Analytics
      </h2>

      <div className="mt-6 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-brand-muted">
            Total Generations
          </span>

          <span className="font-semibold text-brand-ink">
            {analytics.totalGenerations}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-brand-muted">
            Completed
          </span>

          <span className="font-semibold text-green-600">
            {analytics.completedGenerations}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-brand-muted">
            Processing
          </span>

          <span className="font-semibold text-amber-600">
            {analytics.processingGenerations}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-brand-muted">
            Failed
          </span>

          <span className="font-semibold text-red-600">
            {analytics.failedGenerations}
          </span>
        </div>

        <div className="border-t border-brand-border pt-4">
          <div className="flex items-center justify-between">
            <span className="font-medium text-brand-ink">
              Credits
            </span>

            <span className="text-lg font-bold text-brand-ink">
              {analytics.availableCredits}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}