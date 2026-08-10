"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  CreditCard,
  Images,
  LayoutDashboard,
  Plus,
  Settings,
  Users,
} from "lucide-react";

const navigation = [
  { title: "Overview", href: "/salon/dashboard", icon: LayoutDashboard },
  { title: "Clients", href: "/salon/dashboard/clients", icon: Users },
  { title: "New Preview", href: "/upload?source=salon", icon: Plus },
  { title: "Preview History", href: "/salon/dashboard/history", icon: Images },
  { title: "Credits & Billing", href: "/dashboard/payments", icon: CreditCard },
  { title: "Settings", href: "/dashboard/profile", icon: Settings },
];

export function SalonDashboardSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-72 shrink-0 rounded-editorial border border-brand-border bg-brand-surface p-6 shadow-sm">
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-muted">
          Draft My Hair
        </p>
        <h2 className="mt-2 text-xl font-semibold text-brand-ink">
          Salon Workspace
        </h2>
        <p className="mt-1 text-sm text-brand-muted">
          Client consultations & previews
        </p>
      </div>

      <nav className="space-y-2" aria-label="Salon dashboard navigation">
        {navigation.map((item) => {
          const Icon = item.icon;
          const pathOnly = item.href.split("?")[0];
          const active =
            pathname === pathOnly ||
            (pathOnly !== "/salon/dashboard" && pathname.startsWith(pathOnly));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                "flex items-center gap-3 rounded-editorial border px-4 py-3 transition-all duration-200",
                active
                  ? "border-brand-ink bg-brand-ink text-white"
                  : "border-transparent text-brand-muted hover:border-brand-border hover:bg-brand-canvas hover:text-brand-ink",
              ].join(" ")}
            >
              <Icon className="h-5 w-5" />
              <span className="font-medium">{item.title}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-8 rounded-editorial border border-brand-border bg-brand-canvas p-5">
        <div className="flex items-center gap-2 text-brand-ink">
          <CalendarDays className="h-4 w-4" />
          <span className="text-sm font-semibold">Consultation workflow</span>
        </div>
        <p className="mt-3 text-sm leading-6 text-brand-muted">
          Capture the client photo, preview the requested look, then decide together.
        </p>
      </div>
    </aside>
  );
}
