"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

const navigation = [
  { href: "/dashboard/admin", label: "Dashboard" },
  { href: "/dashboard/admin/contact", label: "Contact Messages" },
  { href: "/dashboard/admin/users", label: "Users" },
  { href: "/dashboard/admin/payments", label: "Payments" },
  { href: "/dashboard/admin/generations", label: "AI Generations" },
  { href: "/dashboard/admin/promo-codes", label: "Promo Codes" },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const [unreadCount, setUnreadCount] = useState(0);

  const loadUnreadCount = useCallback(async () => {
    try {
      const response = await fetch("/api/dashboard/admin/contact/unread", {
        cache: "no-store",
      });

      if (!response.ok) return;

      const data = (await response.json()) as { count?: number };
      setUnreadCount(
        Number.isFinite(data.count) ? Math.max(0, data.count ?? 0) : 0
      );
    } catch {
      // Notification state must never break the admin navigation.
    }
  }, []);

  useEffect(() => {
    void loadUnreadCount();

    const interval = window.setInterval(() => {
      void loadUnreadCount();
    }, 10000);

    return () => window.clearInterval(interval);
  }, [loadUnreadCount]);

  return (
    <aside className="w-64 shrink-0 rounded-editorial border border-brand-border bg-brand-surface p-6 shadow-sm">
      <h2 className="mb-6 text-lg font-semibold text-brand-ink">Admin</h2>
      <nav className="space-y-2">
        {navigation.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== "/dashboard/admin" && pathname.startsWith(item.href));
          const showUnread =
            item.href === "/dashboard/admin/contact" && unreadCount > 0;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                active
                  ? "bg-brand-ink text-white"
                  : "text-brand-muted hover:bg-brand-background hover:text-brand-ink"
              }`}
            >
              <span>{item.label}</span>
              {showUnread ? (
                <span
                  aria-label={`${unreadCount} unread customer message${unreadCount === 1 ? "" : "s"}`}
                  className="inline-flex min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 py-0.5 text-[11px] font-semibold leading-none text-white"
                >
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
