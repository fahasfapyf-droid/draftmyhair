"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  Home,
  User,
  Images,
  MessageSquare,
  Wallet,
  CreditCard,
} from "lucide-react";

const navigation = [
  { title: "Overview", href: "/dashboard", icon: Home },
  { title: "Profile", href: "/dashboard/profile", icon: User },
  { title: "Generations", href: "/dashboard/generations", icon: Images },
  { title: "Inbox", href: "/dashboard/inbox", icon: MessageSquare },
  { title: "Wallet", href: "/dashboard/payments", icon: Wallet },
  { title: "Buy Credits", href: "/dashboard/buy-credits", icon: CreditCard },
];

export function DashboardSidebar() {
  const pathname = usePathname();
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshUnreadCount = useCallback(async () => {
    try {
      const response = await fetch("/api/dashboard/inbox/unread", {
        cache: "no-store",
      });

      if (!response.ok) return;

      const data = (await response.json()) as { unreadCount?: number };
      setUnreadCount(
        typeof data.unreadCount === "number" && data.unreadCount > 0
          ? data.unreadCount
          : 0
      );
    } catch {
      // Notification status is non-critical; keep the dashboard usable.
    }
  }, []);

  useEffect(() => {
    void refreshUnreadCount();

    const intervalId = window.setInterval(() => {
      void refreshUnreadCount();
    }, 30000);

    return () => window.clearInterval(intervalId);
  }, [refreshUnreadCount]);

  return (
    <aside className="w-72 shrink-0 rounded-editorial border border-brand-border bg-brand-surface p-6 shadow-sm">
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-brand-ink">Dashboard</h2>
        <p className="mt-1 text-sm text-brand-muted">Manage your account</p>
      </div>

      <nav className="space-y-2">
        {navigation.map((item) => {
          const Icon = item.icon;
          const active =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                "flex items-center justify-between rounded-editorial border px-4 py-3 transition-all duration-200",
                active
                  ? "border-brand-ink bg-brand-ink text-white"
                  : "border-transparent text-brand-muted hover:border-brand-border hover:bg-brand-canvas hover:text-brand-ink",
              ].join(" ")}
            >
              <div className="flex items-center gap-3">
                <Icon className="h-5 w-5" />
                <span className="font-medium">{item.title}</span>
              </div>

              {item.title === "Inbox" && unreadCount > 0 ? (
                <span
                  aria-label={`${unreadCount} unread message${unreadCount === 1 ? "" : "s"}`}
                  className="min-w-6 rounded-full bg-red-600 px-2 py-1 text-center text-[11px] font-bold leading-none text-white shadow-sm"
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
