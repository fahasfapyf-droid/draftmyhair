"use client";

import { useCallback, useEffect, useState } from "react";

type Attempt = {
  id: string;
  attemptNumber: number;
  prompt: string;
  promptRevision: string;
  artifactId: string | null;
  artifactViewPath: string | null;
  qaJson: unknown;
  overallScore: number | string | null;
  verdict: string;
  submittedAt: string | null;
};

type Job = {
  id: string;
  status: string;
  updatedAt: string;
  target: {
    id: string;
    targetKey: string;
    hairstyleId: string | null;
    status: string;
  };
  attempts: Attempt[];
};

type ApprovedHistoryItem = {
  id: string;
  jobId: string;
  attemptNumber: number;
  prompt: string;
  promptRevision: string;
  overallScore: number | string | null;
  submittedAt: string | null;
  generationStartedAt: string | null;
  generationCompletedAt: string | null;
  approvalCompletedAt: string | null;
  artifactId: string | null;
  artifactViewPath: string | null;
  qaReason: string;
  target: {
    id: string;
    targetKey: string;
    hairstyleId: string | null;
  };
};

function score(value: number | string | null) {
  if (value == null) return "—";
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(1) : String(value);
}

function qaReason(value: unknown) {
  if (!value || typeof value !== "object") return "";
  const record = value as Record<string, unknown>;
  return typeof record.reason === "string" ? record.reason : "";
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(date);
}

function duration(start: string | null, end: string | null) {
  if (!start || !end) return "—";
  const startMs = new Date(start).getTime();
  const endMs = new Date(end).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) return "—";
  const seconds = Math.round((endMs - startMs) / 1000);
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

export function RndApprovalQueue() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [history, setHistory] = useState<ApprovedHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [busyJobId, setBusyJobId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [expandedPromptJobId, setExpandedPromptJobId] = useState<string | null>(null);
  const [expandedHistoryPromptId, setExpandedHistoryPromptId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [queueResult, historyResult] = await Promise.allSettled([
      fetch("/api/rnd/approval", { cache: "no-store" }).then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body?.error ?? "Unable to load the R&D approval queue.");
        return Array.isArray(body.jobs) ? body.jobs as Job[] : [];
      }),
      fetch("/api/rnd/approval/history", { cache: "no-store" }).then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body?.error ?? "Unable to load R&D approval history.");
        return Array.isArray(body.history) ? body.history as ApprovedHistoryItem[] : [];
      }),
    ]);

    if (queueResult.status === "fulfilled") {
      setJobs(queueResult.value);
      setNotice("");
    } else {
      setNotice(queueResult.reason instanceof Error ? queueResult.reason.message : "Unable to load the R&D approval queue.");
    }

    if (historyResult.status === "fulfilled") {
      setHistory(historyResult.value);
    } else if (queueResult.status === "fulfilled") {
      setNotice(historyResult.reason instanceof Error ? historyResult.reason.message : "Unable to load R&D approval history.");
    }

    setLoading(false);
    setHistoryLoading(false);
  }, []);

  useEffect(() => {
    void load();
    const interval = window.setInterval(() => void load(), 10000);
    return () => window.clearInterval(interval);
  }, [load]);

  async function approve(jobId: string) {
    setBusyJobId(jobId);
    setNotice("Approving result and capturing the successful prompt…");
    try {
      const response = await fetch("/api/rnd/approval/approve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jobId }),
      });
      const body = await response.json();
      if (!response.ok) {
        setNotice(body?.error ?? "Approval failed.");
        return;
      }
      setNotice(
        body.promptImported
          ? "Approved. The exact successful prompt was captured in Content Library as a DRAFT / TESTING candidate."
          : "Approved. No Content Library prompt was imported because this R&D target is not linked to a hairstyle.",
      );
      await load();
    } catch {
      setNotice("Approval failed.");
    } finally {
      setBusyJobId(null);
    }
  }

  async function reject(jobId: string) {
    const reason = window.prompt("Reason for rejection (optional):") ?? "";
    setBusyJobId(jobId);
    setNotice("Rejecting result…");
    try {
      const response = await fetch("/api/rnd/approval/reject", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jobId, reason }),
      });
      const body = await response.json();
      if (!response.ok) {
        setNotice(body?.error ?? "Rejection failed.");
        return;
      }
      setNotice("Result rejected. It will not be promoted to the Content Library.");
      await load();
    } catch {
      setNotice("Rejection failed.");
    } finally {
      setBusyJobId(null);
    }
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
        Loading R&D approval queue…
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {notice ? (
        <div className="rounded-xl border border-border bg-card p-4 text-sm">{notice}</div>
      ) : null}

      <section className="space-y-5">
        <div>
          <h2 className="text-xl font-semibold">Awaiting human approval</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Only automated R&D results that passed the production QA gate appear here.
          </p>
        </div>

        {jobs.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center">
            <h3 className="text-lg font-semibold">No results awaiting approval</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              When automated QA passes a result at the production gate, it will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {jobs.map((job) => {
              const attempt = job.attempts[0];
              const disabled = busyJobId === job.id;

              return (
                <article key={job.id} className="overflow-hidden rounded-xl border border-border bg-card">
                  <div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_360px]">
                    <div>
                      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
                        <span className="rounded-full border border-border px-2 py-1 font-medium">
                          HUMAN_APPROVAL
                        </span>
                        <span className="text-muted-foreground">
                          Attempt {attempt?.attemptNumber ?? "—"}
                        </span>
                        <span className="text-muted-foreground">
                          QA {score(attempt?.overallScore ?? null)}
                        </span>
                      </div>

                      {attempt?.artifactViewPath ? (
                        <div className="overflow-hidden rounded-lg bg-muted">
                          <img
                            src={attempt.artifactViewPath}
                            alt="R&D hairstyle transformation awaiting approval"
                            className="mx-auto max-h-[75vh] w-auto max-w-full object-contain"
                          />
                        </div>
                      ) : (
                        <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
                          Generated artifact is unavailable.
                        </div>
                      )}
                    </div>

                    <div className="h-fit space-y-5">
                      <div>
                        <h3 className="text-lg font-semibold">Review result</h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Target: <span className="font-medium text-foreground">{job.target.targetKey}</span>
                        </p>
                      </div>

                      <div className="rounded-lg border border-border p-4 text-sm">
                        <div className="font-medium">Automated QA</div>
                        <dl className="mt-3 space-y-2 text-muted-foreground">
                          <div className="flex justify-between gap-4">
                            <dt>Overall</dt>
                            <dd className="font-medium text-foreground">{score(attempt?.overallScore ?? null)}</dd>
                          </div>
                          <div className="flex justify-between gap-4">
                            <dt>Verdict</dt>
                            <dd className="font-medium text-foreground">{attempt?.verdict ?? "—"}</dd>
                          </div>
                        </dl>
                        {qaReason(attempt?.qaJson) ? (
                          <p className="mt-3 border-t border-border pt-3 text-xs leading-5 text-muted-foreground">
                            {qaReason(attempt?.qaJson)}
                          </p>
                        ) : null}
                      </div>

                      <div className="rounded-lg border border-border p-4 text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="font-medium">Exact prompt used</div>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Prompt revision: {attempt?.promptRevision ?? "—"}
                            </p>
                          </div>
                          {attempt?.prompt ? (
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedPromptJobId((current) =>
                                  current === job.id ? null : job.id,
                                )
                              }
                              className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold"
                            >
                              {expandedPromptJobId === job.id ? "Hide prompt" : "Show prompt"}
                            </button>
                          ) : null}
                        </div>
                        {expandedPromptJobId === job.id && attempt?.prompt ? (
                          <div className="mt-3">
                            <div className="max-h-[420px] overflow-auto rounded-md border border-border bg-muted p-3">
                              <pre className="whitespace-pre-wrap break-words text-xs leading-5">
                                {attempt.prompt}
                              </pre>
                            </div>
                            <button
                              type="button"
                              onClick={() => void navigator.clipboard?.writeText(attempt.prompt)}
                              className="mt-2 rounded-md border border-border px-3 py-1.5 text-xs font-semibold"
                            >
                              Copy exact prompt
                            </button>
                          </div>
                        ) : null}
                      </div>

                      <div className="rounded-lg border border-border p-4 text-sm">
                        <div className="font-medium">Approval action</div>
                        <p className="mt-2 text-muted-foreground">
                          Approval records this exact successful R&D attempt and automatically captures its exact prompt in Content Library as a DRAFT / TESTING candidate. It does not make the prompt customer-active.
                        </p>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                        <button
                          type="button"
                          disabled={disabled || !attempt}
                          onClick={() => void approve(job.id)}
                          className="rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {busyJobId === job.id ? "Processing…" : "Approve & capture prompt"}
                        </button>
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() => void reject(job.id)}
                          className="rounded-md border border-border bg-background px-4 py-2.5 text-sm font-semibold text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">Approved R&D History</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Persistent record of every R&D generation that received human approval.
            </p>
          </div>
          <div className="rounded-full border border-border px-3 py-1 text-xs font-medium">
            {history.length} approved
          </div>
        </div>

        {historyLoading ? (
          <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
            Loading approved history…
          </div>
        ) : history.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center">
            <h3 className="text-lg font-semibold">No approved R&D generations yet</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Approved generations will remain visible here after they leave the queue.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 xl:grid-cols-2">
            {history.map((item) => {
              const promptExpanded = expandedHistoryPromptId === item.id;

              return (
                <article key={item.id} className="overflow-hidden rounded-xl border border-border bg-card">
                  <div className="grid gap-5 p-5 md:grid-cols-[180px_minmax(0,1fr)]">
                    <div>
                      {item.artifactViewPath ? (
                        <div className="overflow-hidden rounded-lg bg-muted">
                          <img
                            src={item.artifactViewPath}
                            alt={`Approved R&D transformation for ${item.target.targetKey}`}
                            className="h-[240px] w-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="flex h-[240px] items-center justify-center rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                          Generated artifact unavailable.
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 space-y-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="rounded-full border border-border px-2 py-1 font-medium">
                            APPROVED
                          </span>
                          <span className="text-muted-foreground">
                            Attempt {item.attemptNumber}
                          </span>
                          <span className="text-muted-foreground">
                            QA {score(item.overallScore)}
                          </span>
                        </div>
                        <h3 className="mt-2 break-words text-base font-semibold">
                          {item.target.targetKey}
                        </h3>
                      </div>

                      <dl className="grid gap-3 text-xs sm:grid-cols-2">
                        <div className="rounded-md border border-border p-3">
                          <dt className="text-muted-foreground">Generated</dt>
                          <dd className="mt-1 font-medium">{formatDate(item.generationCompletedAt)}</dd>
                        </div>
                        <div className="rounded-md border border-border p-3">
                          <dt className="text-muted-foreground">Approved</dt>
                          <dd className="mt-1 font-medium">{formatDate(item.approvalCompletedAt)}</dd>
                        </div>
                        <div className="rounded-md border border-border p-3">
                          <dt className="text-muted-foreground">Generation time</dt>
                          <dd className="mt-1 font-medium">
                            {duration(item.generationStartedAt, item.generationCompletedAt)}
                          </dd>
                        </div>
                        <div className="rounded-md border border-border p-3">
                          <dt className="text-muted-foreground">Prompt revision</dt>
                          <dd className="mt-1 font-medium">{item.promptRevision}</dd>
                        </div>
                      </dl>

                      {item.qaReason ? (
                        <p className="border-t border-border pt-3 text-xs leading-5 text-muted-foreground">
                          {item.qaReason}
                        </p>
                      ) : null}

                      <div className="rounded-lg border border-border p-3 text-xs">
                        <div className="flex items-center justify-between gap-3">
                          <div className="font-medium">Exact approved prompt</div>
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedHistoryPromptId((current) =>
                                current === item.id ? null : item.id,
                              )
                            }
                            className="rounded-md border border-border px-2.5 py-1.5 font-semibold"
                          >
                            {promptExpanded ? "Hide prompt" : "Show prompt"}
                          </button>
                        </div>
                        {promptExpanded ? (
                          <div className="mt-3">
                            <div className="max-h-[360px] overflow-auto rounded-md border border-border bg-muted p-3">
                              <pre className="whitespace-pre-wrap break-words text-xs leading-5">
                                {item.prompt}
                              </pre>
                            </div>
                            <button
                              type="button"
                              onClick={() => void navigator.clipboard?.writeText(item.prompt)}
                              className="mt-2 rounded-md border border-border px-3 py-1.5 font-semibold"
                            >
                              Copy exact prompt
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
