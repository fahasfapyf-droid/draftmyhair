"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

const FEEDBACK_LAST_SEEN_KEY = "draftmyhair:admin-feedback-last-seen";

type GenerationStats = {
  totalRequests: number;
  completedImages: number;
  failed: number;
  processing: number;
  pro: number;
  flash: number;
};

const EMPTY_GENERATION_STATS: GenerationStats = {
  totalRequests: 0,
  completedImages: 0,
  failed: 0,
  processing: 0,
  pro: 0,
  flash: 0,
};

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
  const [generationStats, setGenerationStats] = useState<GenerationStats>(
    EMPTY_GENERATION_STATS
  );

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

  const loadGenerationStats = useCallback(async () => {
    try {
      const response = await fetch("/api/dashboard/admin/generation-stats", {
        cache: "no-store",
      });

      if (!response.ok) return;

      const data = (await response.json()) as Partial<GenerationStats>;
      setGenerationStats({
        totalRequests: Number.isFinite(data.totalRequests)
          ? Math.max(0, data.totalRequests ?? 0)
          : 0,
        completedImages: Number.isFinite(data.completedImages)
          ? Math.max(0, data.completedImages ?? 0)
          : 0,
        failed: Number.isFinite(data.failed) ? Math.max(0, data.failed ?? 0) : 0,
        processing: Number.isFinite(data.processing)
          ? Math.max(0, data.processing ?? 0)
          : 0,
        pro: Number.isFinite(data.pro) ? Math.max(0, data.pro ?? 0) : 0,
        flash: Number.isFinite(data.flash) ? Math.max(0, data.flash ?? 0) : 0,
      });
    } catch {
      // Generation statistics must never break the admin dashboard.
    }
  }, []);

  useEffect(() => {
    void loadUnreadFeedbackCount();
    void loadGenerationStats();

    const interval = window.setInterval(() => {
      void loadUnreadFeedbackCount();
      void loadGenerationStats();
    }, 10000);

    return () => window.clearInterval(interval);
  }, [loadGenerationStats, loadUnreadFeedbackCount]);

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

      <section
        aria-label="AI generation overview"
        className="rounded-editorial border border-brand-border bg-brand-surface p-6 shadow-sm"
      >
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.14em] text-brand-muted">
              Completed Images
            </p>
            <p className="mt-1 text-4xl font-semibold tracking-tight text-brand-ink">
              {generationStats.completedImages.toLocaleString()}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-4 lg:min-w-[560px]">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-brand-muted">
                Total Requests
              </p>
              <p className="mt-1 text-lg font-semibold text-brand-ink">
                {generationStats.totalRequests.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-brand-muted">
                Failed
              </p>
              <p className="mt-1 text-lg font-semibold text-brand-ink">
                {generationStats.failed.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-brand-muted">
                Processing
              </p>
              <p className="mt-1 text-lg font-semibold text-brand-ink">
                {generationStats.processing.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-brand-muted">
                Models
              </p>
              <p className="mt-1 text-sm font-semibold text-brand-ink">
                Pro {generationStats.pro.toLocaleString()} · Flash {generationStats.flash.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </section>

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
