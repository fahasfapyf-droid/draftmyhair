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

export function RndApprovalQueue() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyJobId, setBusyJobId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [expandedPromptJobId, setExpandedPromptJobId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/rnd/approval", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) {
        setNotice(body?.error ?? "Unable to load the R&D approval queue.");
        return;
      }
      setJobs(Array.isArray(body.jobs) ? body.jobs : []);
      setNotice("");
    } catch {
      setNotice("Unable to load the R&D approval queue.");
    } finally {
      setLoading(false);
    }
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
    <div className="space-y-6">
      {notice ? (
        <div className="rounded-xl border border-border bg-card p-4 text-sm">{notice}</div>
      ) : null}

      {jobs.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <h2 className="text-lg font-semibold">No results awaiting approval</h2>
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
                      <h2 className="text-lg font-semibold">Review result</h2>
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
    </div>
  );
}
