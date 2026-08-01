export function AdminHome() {
  return (
    <div className="space-y-8">
      <div className="rounded-editorial border border-brand-border bg-brand-surface p-8 shadow-sm">
        <h2 className="text-2xl font-semibold text-brand-ink">
          Welcome, Administrator
        </h2>

        <p className="mt-3 text-brand-muted">
          This dashboard provides access to administrative tools for
          Draft My Hair.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-editorial border border-brand-border bg-brand-surface p-6">
          <h3 className="font-semibold text-brand-ink">
            Contact Messages
          </h3>

          <p className="mt-2 text-sm text-brand-muted">
            View and manage customer enquiries.
          </p>
        </div>

        <div className="rounded-editorial border border-brand-border bg-brand-surface p-6">
          <h3 className="font-semibold text-brand-ink">
            Users
          </h3>

          <p className="mt-2 text-sm text-brand-muted">
            Manage customer accounts.
          </p>
        </div>

        <div className="rounded-editorial border border-brand-border bg-brand-surface p-6">
          <h3 className="font-semibold text-brand-ink">
            Payments
          </h3>

          <p className="mt-2 text-sm text-brand-muted">
            Review purchases and credit activity.
          </p>
        </div>

        <div className="rounded-editorial border border-brand-border bg-brand-surface p-6">
          <h3 className="font-semibold text-brand-ink">
            Generations
          </h3>

          <p className="mt-2 text-sm text-brand-muted">
            Monitor AI hairstyle generations.
          </p>
        </div>
      </div>
    </div>
  );
}