export default function DashboardLoading() {
  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <div className="mb-8">
        <div className="h-8 w-56 animate-pulse rounded bg-brand-border" />
        <div className="mt-3 h-4 w-80 animate-pulse rounded bg-brand-border" />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-editorial border border-brand-border bg-brand-surface p-6 shadow-sm">
          <div className="h-6 w-32 animate-pulse rounded bg-brand-border" />

          <div className="mt-6 space-y-4">
            <div className="h-5 w-48 animate-pulse rounded bg-brand-border" />
            <div className="h-5 w-56 animate-pulse rounded bg-brand-border" />
            <div className="h-5 w-24 animate-pulse rounded bg-brand-border" />
          </div>
        </div>

        <div className="rounded-editorial border border-brand-border bg-brand-surface p-6 shadow-sm">
          <div className="h-6 w-44 animate-pulse rounded bg-brand-border" />

          <div className="mt-6 space-y-4">
            {[1, 2, 3].map((item) => (
              <div
                key={item}
                className="flex items-center gap-4 rounded border border-brand-border p-4"
              >
                <div className="h-16 w-16 animate-pulse rounded bg-brand-border" />

                <div className="flex-1 space-y-2">
                  <div className="h-4 w-40 animate-pulse rounded bg-brand-border" />
                  <div className="h-3 w-24 animate-pulse rounded bg-brand-border" />
                </div>

                <div className="h-4 w-20 animate-pulse rounded bg-brand-border" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}