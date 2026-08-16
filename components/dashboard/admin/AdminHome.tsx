"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

const FEEDBACK_LAST_SEEN_KEY = "draftmyhair:admin-feedback-last-seen";

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
  const [unreadFeedbackCount, setUnreadFeedbackCount] = useState(0);

  const loadUnreadFeedbackCount = useCallback(async () => {
    try {
      const stored = window.localStorage.getItem(FEEDBACK_LAST_SEEN_KEY);

      if (!stored) {
        window.localStorage.setItem(
          FEEDBACK_LAST_SEEN_KEY,
          new Date().toISOString()
        );
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
      // Notification state must never break the admin dashboard.
    }
  }, []);

  useEffect(() => {
    void loadUnreadFeedbackCount();

    const interval = window.setInterval(() => {
      void loadUnreadFeedbackCount();
    }, 10000);

    return () => window.clearInterval(interval);
  }, [loadUnreadFeedbackCount]);

  const markFeedbackSeen = () => {
    window.localStorage.setItem(
      FEEDBACK_LAST_SEEN_KEY,
      new Date().toISOString()
    );
    setUnreadFeedbackCount(0);
  };

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

      {unreadFeedbackCount > 0 ? (
        <div
          role="status"
          aria-live="polite"
          className="rounded-editorial border border-red-200 bg-red-50 p-5 shadow-sm"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-red-800">
                New customer feedback
              </p>
              <p className="mt-1 text-sm text-red-700">
                {unreadFeedbackCount} new feedback submission
                {unreadFeedbackCount === 1 ? "" : "s"} is waiting for review.
              </p>
            </div>
            <Link
              href="/dashboard/admin/feedback"
              onClick={markFeedbackSeen}
              className="inline-flex items-center justify-center rounded-lg bg-brand-ink px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
            >
              Review feedback →
            </Link>
          </div>
        </div>
      ) : null}

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

      <div className="rounded-editorial border border-brand-border bg-brand-surface p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="font-semibold text-brand-ink">Customer Feedback</h3>
            <p className="mt-1 text-sm text-brand-muted">
              Review customer ratings and comments.
            </p>
          </div>
          <Link
            href="/dashboard/admin/feedback"
            onClick={markFeedbackSeen}
            className="text-sm font-medium text-brand-ink hover:underline"
          >
            Open feedback →
          </Link>
        </div>
      </div>
    </div>
  );
}
