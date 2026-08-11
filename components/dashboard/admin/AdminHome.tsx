import Link from "next/link";

const adminCards = [
  {
    href: "/dashboard/admin/contact",
    title: "Contact Messages",
    description: "View and manage customer enquiries.",
  },
  {
    href: "/dashboard/admin/users",
    title: "Users",
    description: "Manage customer accounts.",
  },
  {
    href: "/dashboard/admin/payments",
    title: "Payments",
    description: "Review purchases and credit activity.",
  },
  {
    href: "/dashboard/admin/generations",
    title: "Generations",
    description: "Monitor AI hairstyle generations.",
  },
] as const;

export function AdminHome() {
  return (
    <div className="space-y-8">
      <div className="rounded-editorial border border-brand-border bg-brand-surface p-8 shadow-sm">
        <h2 className="text-2xl font-semibold text-brand-ink">
          Welcome, Administrator
        </h2>

        <p className="mt-3 text-brand-muted">
          This dashboard provides access to administrative tools for Draft My Hair.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {adminCards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="group rounded-editorial border border-brand-border bg-brand-surface p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-brand-ink focus:ring-offset-2"
          >
            <h3 className="font-semibold text-brand-ink group-hover:underline">
              {card.title}
            </h3>
            <p className="mt-2 text-sm text-brand-muted">
              {card.description}
            </p>
            <span className="mt-5 inline-block text-sm font-medium text-brand-ink">
              Open →
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
