"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

const FEEDBACK_LAST_SEEN_KEY = "draftmyhair:admin-feedback-last-seen";

type GenerationStats = {
  total: number;
  completed: number;
  failed: number;
  processing: number;
  models: {
    pro: { total: number; completed: number; failed: number; processing: number };
    flash: { total: number; completed: number; failed: number; processing: number };
  };
};

const adminCards = [
  { href: "/dashboard/admin/contact", title: "Contact Messages", description: "View and manage customer enquiries." },
  { href: "/dashboard/admin/users", title: "Users", description: "Manage customer accounts." },
  { href: "/dashboard/admin/payments", title: "Payments", description: "Review purchases and credit activity." },
  { href: "/dashboard/admin/generations", title: "Generations", description: "Monitor AI hairstyle generations." },
] as const;

export function AdminHome() {
  const [unreadFeedbackCount, setUnreadFeedbackCount] = useState(0);
  const [generationStats, setGenerationStats] = useState<GenerationStats | null>(null);

  const loadUnreadFeedbackCount = useCallback(async () => {
    try {
      const stored = window.localStorage.getItem(FEEDBACK_LAST_SEEN_KEY);
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
      setUnreadFeedbackCount(Number.isFinite(data.count) ? Math.max(0, data.count ?? 0) : 0);
    } catch {
      // Notification state must never break the admin dashboard.
    }
  }, []);

  const loadGenerationStats = useCallback(async () => {
    try {
      const response = await fetch("/api/dashboard/admin/generations/stats", { cache: "no-store" });
      if (!response.ok) return;
      setGenerationStats((await response.json()) as GenerationStats);
    } catch {
      // Generation stats must never break the admin dashboard.
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
  }, [loadUnreadFeedbackCount, loadGenerationStats]);

  const markFeedbackSeen = () => {
    window.localStorage.setItem(FEEDBACK_LAST_SEEN_KEY, new Date().toISOString());
    setUnreadFeedbackCount(0);
  };

  const generationSummary = generationStats
    ? [
        { label: "Total generations", value: generationStats.total },
        { label: "Completed", value: generationStats.completed },
        { label: "Failed", value: generationStats.failed },
        { label: "Processing", value: generationStats.processing },
      ]
    : [];

  const modelStats = generationStats
    ? [
        { label: "Pro 2K", ...generationStats.models.pro },
        { label: "Flash 2K", ...generationStats.models.flash },
      ]
    : [];

  return (
    <div className="space-y-8">
      <div className="rounded-editorial border border-brand-border bg-brand-surface p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h3 className="font-semibold text-brand-ink">AI Generation Overview</h3>
            <p className="mt-1 text-sm text-brand-muted">Lifetime generation activity by status and model.</p>
          </div>
          <Link href="/dashboard/admin/generations" className="text-sm font-medium text-brand-ink hover:underline">
            View all →
          </Link>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {generationSummary.map((stat) => (
            <div key={stat.label} className="rounded-lg border border-brand-border px-4 py-3">
              <p className="text-xs text-brand-muted">{stat.label}</p>
              <p className="mt-1 text-2xl font-semibold text-brand-ink">{stat.value.toLocaleString()}</p>
            </div>
          ))}
        </div>

        {generationStats ? (
          <div className="mt-4 overflow-x-auto rounded-lg border border-brand-border">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-brand-border text-brand-muted">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Model</th>
                  <th className="px-4 py-2.5 text-right font-medium">Total</th>
                  <th className="px-4 py-2.5 text-right font-medium">Completed</th>
                  <th className="px-4 py-2.5 text-right font-medium">Failed</th>
                  <th className="px-4 py-2.5 text-right font-medium">Processing</th>
                </tr>
              </thead>
              <tbody>
                {modelStats.map((model) => (
                  <tr key={model.label} className="border-b border-brand-border last:border-0">
                    <td className="px-4 py-2.5 font-medium text-brand-ink">{model.label}</td>
                    <td className="px-4 py-2.5 text-right text-brand-ink">{model.total.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right text-brand-muted">{model.completed.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right text-brand-muted">{model.failed.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right text-brand-muted">{model.processing.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-4 text-sm text-brand-muted">Loading generation statistics…</p>
        )}
      </div>

      {unreadFeedbackCount > 0 ? (
        <div role="status" aria-live="polite" className="rounded-editorial border border-red-200 bg-red-50 p-5 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-red-800">New customer feedback</p>
              <p className="mt-1 text-sm text-red-700">
                {unreadFeedbackCount} new feedback submission{unreadFeedbackCount === 1 ? "" : "s"} is waiting for review.
              </p>
            </div>
            <Link href="/dashboard/admin/feedback" onClick={markFeedbackSeen} className="inline-flex items-center justify-center rounded-lg bg-brand-ink px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90">
              Review feedback →
            </Link>
          </div>
        </div>
      ) : null}

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {adminCards.map((card) => (
          <Link key={card.href} href={card.href} className="group rounded-editorial border border-brand-border bg-brand-surface p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-brand-ink focus:ring-offset-2">
            <h3 className="font-semibold text-brand-ink group-hover:underline">{card.title}</h3>
            <p className="mt-2 text-sm text-brand-muted">{card.description}</p>
            <span className="mt-5 inline-block text-sm font-medium text-brand-ink">Open →</span>
          </Link>
        ))}
      </div>

      <div className="rounded-editorial border border-brand-border bg-brand-surface p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="font-semibold text-brand-ink">Customer Feedback</h3>
            <p className="mt-1 text-sm text-brand-muted">Review customer ratings and comments.</p>
          </div>
          <Link href="/dashboard/admin/feedback" onClick={markFeedbackSeen} className="text-sm font-medium text-brand-ink hover:underline">
            Open feedback →
          </Link>
        </div>
      </div>
    </div>
  );
}
