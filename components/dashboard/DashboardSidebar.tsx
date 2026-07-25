"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  User,
  Images,
  Wallet,
  CreditCard,
  Settings,
} from "lucide-react";

const navigation = [
  {
    title: "Overview",
    href: "/dashboard",
    icon: Home,
    available: true,
  },
  {
    title: "Profile",
    href: "/dashboard/profile",
    icon: User,
    available: true,
  },
  {
    title: "Generations",
    href: "/dashboard/generations",
    icon: Images,
    available: false,
  },
  {
    title: "Credits",
    href: "/dashboard/credits",
    icon: Wallet,
    available: false,
  },
  {
    title: "Payments",
    href: "/dashboard/payments",
    icon: CreditCard,
    available: false,
  },
  {
    title: "Settings",
    href: "/dashboard/settings",
    icon: Settings,
    available: false,
  },
];

export function DashboardSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-72 shrink-0 rounded-editorial border border-brand-border bg-brand-surface p-6 shadow-sm">
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-brand-ink">
          Dashboard
        </h2>

        <p className="mt-1 text-sm text-brand-muted">
          Manage your account
        </p>
      </div>

      <nav className="space-y-2">
        {navigation.map((item) => {
          const Icon = item.icon;

          const active =
            pathname === item.href;

          return (
            <Link
              key={item.href}
              href={
                item.available
                  ? item.href
                  : "#"
              }
              className={[
                "flex items-center justify-between rounded-editorial border px-4 py-3 transition-all duration-200",
                active
                  ? "border-brand-ink bg-brand-ink text-white"
                  : "border-transparent text-brand-muted hover:border-brand-border hover:bg-brand-canvas hover:text-brand-ink",
                !item.available &&
                  "cursor-default opacity-70",
              ].join(" ")}
            >
              <div className="flex items-center gap-3">
                <Icon className="h-5 w-5" />

                <span className="font-medium">
                  {item.title}
                </span>
              </div>

              {!item.available && (
                <span className="rounded-full bg-brand-border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide">
                  Soon
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}