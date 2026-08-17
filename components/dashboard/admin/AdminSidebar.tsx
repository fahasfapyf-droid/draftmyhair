"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

const navigation = [
  { href: "/dashboard/admin", label: "Dashboard" },
  { href: "/dashboard/admin/content", label: "Content Library" },
  { href: "/dashboard/admin/contact", label: "Contact Messages" },
  { href: "/dashboard/admin/feedback", label: "Customer Feedback" },
  { href: "/dashboard/admin/users", label: "Users" },
  { href: "/dashboard/admin/payments", label: "Payments" },
  { href: "/dashboard/admin/generations", label: "AI Generations" },
  { href: "/dashboard/admin/promo-codes", label: "Promo Codes" },
];

const FEEDBACK_LAST_SEEN_KEY = "draftmyhair:admin-feedback-last-seen";

export function AdminSidebar() {
  const pathname = usePathname();
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const [unreadFeedbackCount, setUnreadFeedbackCount] = useState(0);

  const loadUnreadMessageCount = useCallback(async () => {
    try {
      const response = await fetch("/api/dashboard/admin/contact/unread", {
        cache: "no-store",
      });

      if (!response.ok) return;

      const data = (await response.json()) as { count?: number };
      setUnreadMessageCount(
        Number.isFinite(data.count) ? Math.max(0, data.count ?? 0) : 0
      );
    } catch {
      // Notification state must never break the admin navigation.
    }
  }, []);

  const loadUnreadFeedbackCount = useCallback(async () => {
    try {
      const stored = window.localStorage.getItem(FEEDBACK_LAST_SEEN_KEY);

      // Establish a baseline on first use without surfacing historical feedback.
      if (!stored) {
        window.localStorage.setItem(FEEDBACK_LAST_SEEN_KEY, new Date().toISOString());
        setUnreadFeedbackCount(0);
        return;
      }

      const response = await fetch(
        `/api/dashboard/admin/feedback/unread?since=${encodeURIComponent(stored)}`,
        { cache: "no-store" }
      );

      if (!response.ok) return;

      const data = (await response.json()) as { count?: number };
      setUnreadFeedbackCount(
        Number.isFinite(data.count) ? Math.max(0, data.count ?? 0) : 0
      );
    } catch {
      // Notification state must never break the admin navigation.
    }
  }, []);

  useEffect(() => {
    // Visiting the feedback page establishes the read baseline once.
    // The polling below must NOT keep moving this timestamp, otherwise new
    // feedback received while the page is open would never become unread.
    if (pathname.startsWith("/dashboard/admin/feedback")) {
      window.localStorage.setItem(FEEDBACK_LAST_SEEN_KEY, new Date().toISOString());
      setUnreadFeedbackCount(0);
    }

    void loadUnreadMessageCount();
    void loadUnreadFeedbackCount();

    const interval = window.setInterval(() => {
      void loadUnreadMessageCount();
      void loadUnreadFeedbackCount();
    }, 10000);

    return () => window.clearInterval(interval);
  }, [pathname, loadUnreadMessageCount, loadUnreadFeedbackCount]);

  return (
    <aside className="w-64 shrink-0 rounded-editorial border border-brand-border bg-brand-surface p-6 shadow-sm">
      <h2 className="mb-6 text-lg font-semibold text-brand-ink">Admin</h2>
      <nav className="space-y-2">
        {navigation.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== "/dashboard/admin" && pathname.startsWith(item.href));
          const showUnreadMessages =
            item.href === "/dashboard/admin/contact" && unreadMessageCount > 0;
          const showUnreadFeedback =
            item.href === "/dashboard/admin/feedback" && unreadFeedbackCount > 0;

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
              {showUnreadMessages ? (
                <span
                  aria-label={`${unreadMessageCount} unread customer message${unreadMessageCount === 1 ? "" : "s"}`}
                  className="inline-flex min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 py-0.5 text-[11px] font-semibold leading-none text-white"
                >
                  {unreadMessageCount > 99 ? "99+" : unreadMessageCount}
                </span>
              ) : null}
              {showUnreadFeedback ? (
                <span
                  aria-label={`${unreadFeedbackCount} new customer feedback${unreadFeedbackCount === 1 ? "" : "s"}`}
                  className="inline-flex min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 py-0.5 text-[11px] font-semibold leading-none text-white"
                >
                  {unreadFeedbackCount > 99 ? "99+" : unreadFeedbackCount}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
