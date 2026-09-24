"use client";

import { useCallback, useEffect, useState } from "react";

type Job = {
  id: string;
  status: string;
  attemptCount: number;
  promptVersionNumber: number;
  createdAt: string;
  queuedAt: string | null;
  nextEligibleAt: string | null;
  target: {
    targetKey: string;
    status: string;
    hairstyleId: string | null;
    campaign: { name: string };
  };
  attempts: Array<{
    attemptNumber: number;
    verdict: string;
    overallScore: number | null;
    aiGatePassed: boolean;
    refinementSlot: string | null;
    refinementReason: string | null;
    qaJson: unknown;
  }>;
};

export function RndConsole() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/dashboard/admin/rnd", { cache: "no-store" });
      if (!response.ok) return;
      const data = (await response.json()) as { jobs: Job[] };
      setJobs(data.jobs);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const interval = window.setInterval(() => void load(), 5000);
    return () => window.clearInterval(interval);
  }, [load]);

  const createRegression = async () => {
    setCreating(true);
    setMessage(null);
    try {
      const response = await fetch("/api/dashboard/admin/rnd", { method: "POST" });
      const data = (await response.json()) as { jobId?: string; error?: string };
      if (!response.ok) throw new Error(data.error || "Could not create regression job.");
      setMessage(`Queued regression job ${data.jobId}.`);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not create regression job.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-editorial border border-brand-border bg-brand-surface p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold text-brand-ink">Universal Refinement Regression</h2>
            <p className="mt-1 max-w-2xl text-sm text-brand-muted">
              Creates a clean Italian Bob R&D job using the current v3-single master prompt
              and current compiled Italian Bob definition. The historical exhausted job is not modified.
            </p>
          </div>
          <button
            type="button"
            onClick={createRegression}
            disabled={creating}
            className="inline-flex shrink-0 items-center justify-center rounded-lg bg-brand-ink px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {creating ? "Creating…" : "Create regression run"}
          </button>
        </div>
        {message ? (
          <p className="mt-4 rounded-lg border border-brand-border px-4 py-3 text-sm text-brand-ink">
            {message}
          </p>
        ) : null}
      </section>

      <section className="rounded-editorial border border-brand-border bg-brand-surface p-6 shadow-sm">
        <div className="mb-4">
          <h2 className="font-semibold text-brand-ink">R&D Jobs</h2>
          <p className="mt-1 text-sm text-brand-muted">Auto-refreshes every 5 seconds.</p>
        </div>

        {loading ? (
          <p className="text-sm text-brand-muted">Loading…</p>
        ) : jobs.length === 0 ? (
          <p className="text-sm text-brand-muted">No R&D jobs found.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-brand-border">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-brand-border text-brand-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Target</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Attempts</th>
                  <th className="px-4 py-3 text-right font-medium">Score</th>
                  <th className="px-4 py-3 font-medium">Last verdict</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => {
                  const attempt = job.attempts[0];
                  return (
                    <tr key={job.id} className="border-b border-brand-border last:border-0">
                      <td className="px-4 py-3">
                        <p className="font-medium text-brand-ink">{job.target.targetKey}</p>
                        <p className="text-xs text-brand-muted">
                          {job.target.hairstyleId ? "italian-bob" : "unknown"} · {job.id}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-brand-ink">{job.status}</td>
                      <td className="px-4 py-3 text-right text-brand-ink">
                        {job.attemptCount}
                      </td>
                      <td className="px-4 py-3 text-right text-brand-ink">
                        {attempt?.overallScore ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-brand-muted">
                        {attempt?.verdict ?? "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
