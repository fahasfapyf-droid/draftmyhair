"use client";

import { useCallback, useEffect, useState } from "react";

type Profile = {
  id: string; label: string; effectiveStatus: string; generationCount: number; hourlyLimit: number;
  lastUsedAt: string | null; cooldownUntil: string | null; lastError: string | null;
};
type Worker = {
  workerId: string; workerVersion: string | null; protocolVersion: string | null; workerState: string;
  activeProfileId: string | null; activeProfileLabel: string | null; currentJobId: string | null;
  captureStatus: string; captureLastSuccessAt: string | null; captureLastError: string | null;
  profileSnapshot: Profile[] | null; lastHeartbeatAt: string; online: boolean;
};
function time(value: string | null) { if (!value) return "—"; const date = new Date(value); return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString(); }
function badgeClass(value: string) {
  const v = value.toUpperCase();
  if (["ONLINE","ACTIVE","PASS","READY"].includes(v)) return "inline-flex rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-xs font-semibold text-emerald-700";
  if (["EXHAUSTED","PAUSED","COOLDOWN","UNKNOWN"].includes(v)) return "inline-flex rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-xs font-semibold text-amber-700";
  if (["RESTRICTED","FAIL","OFFLINE","STOPPED"].includes(v)) return "inline-flex rounded-full border border-red-500/40 bg-red-500/10 px-2 py-1 text-xs font-semibold text-red-700";
  return "inline-flex rounded-full border border-border bg-muted px-2 py-1 text-xs font-semibold text-muted-foreground";
}

export function RndWorkerMonitor() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/rnd/dashboard/worker-status", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) { setNotice(body?.error ?? "Unable to load worker status."); return; }
      setWorkers(Array.isArray(body.workers) ? body.workers : []); setNotice("");
    } catch { setNotice("Unable to load worker status."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); const interval = window.setInterval(() => void load(), 5000); return () => window.clearInterval(interval); }, [load]);

  if (loading) return <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">Loading worker status…</div>;

  return <div className="space-y-6">
    {notice ? <div className="rounded-xl border border-border bg-card p-4 text-sm">{notice}</div> : null}
    {!workers.length ? <div className="rounded-xl border border-border bg-card p-8 text-center"><h2 className="text-lg font-semibold">No worker has reported yet</h2><p className="mt-2 text-sm text-muted-foreground">Start the local Gemini worker and its first status heartbeat will appear here.</p></div> : null}
    {workers.map((worker) => <section key={worker.workerId} className="space-y-5 rounded-xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-lg font-semibold">R&D Worker</h2><p className="mt-1 text-xs text-muted-foreground">ID {worker.workerId}</p></div><span className={badgeClass(worker.online ? "ONLINE" : "OFFLINE")}>{worker.online ? "ONLINE" : "OFFLINE"}</span></div>
      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-lg border border-border p-4"><div className="text-xs text-muted-foreground">Worker version</div><div className="mt-1 font-semibold">{worker.workerVersion ?? "—"}</div></div>
        <div className="rounded-lg border border-border p-4"><div className="text-xs text-muted-foreground">Protocol</div><div className="mt-1 font-semibold">{worker.protocolVersion ?? "—"}</div></div>
        <div className="rounded-lg border border-border p-4"><div className="text-xs text-muted-foreground">Current job</div><div className="mt-1 truncate font-semibold">{worker.currentJobId ?? "Idle"}</div></div>
        <div className="rounded-lg border border-border p-4"><div className="text-xs text-muted-foreground">Last heartbeat</div><div className="mt-1 font-semibold">{time(worker.lastHeartbeatAt)}</div></div>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-lg border border-border p-4"><div className="flex items-center justify-between gap-3"><h3 className="font-semibold">Gemini profiles</h3><span className={badgeClass(worker.activeProfileId ? "ACTIVE" : "UNKNOWN")}>{worker.activeProfileLabel ?? worker.activeProfileId ?? "None selected"}</span></div>
          <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b border-border text-xs text-muted-foreground"><th className="py-2 pr-3">Profile</th><th className="py-2 pr-3">State</th><th className="py-2 pr-3">Usage</th><th className="py-2 pr-3">Last use</th><th className="py-2">Error</th></tr></thead><tbody>
            {(worker.profileSnapshot ?? []).map((profile) => <tr key={profile.id} className="border-b border-border last:border-0"><td className="py-2 pr-3"><div className="font-medium">{profile.label}</div><div className="text-xs text-muted-foreground">{profile.id}</div></td><td className="py-2 pr-3"><span className={badgeClass(profile.effectiveStatus)}>{profile.effectiveStatus}</span></td><td className="py-2 pr-3">{profile.generationCount} / {profile.hourlyLimit}</td><td className="py-2 pr-3 text-xs">{time(profile.lastUsedAt)}</td><td className="max-w-56 py-2 text-xs text-muted-foreground">{profile.lastError ?? "—"}</td></tr>)}
          </tbody></table></div>
        </div>
        <div className="rounded-lg border border-border p-4"><div className="flex items-center justify-between gap-3"><h3 className="font-semibold">Capture</h3><span className={badgeClass(worker.captureStatus)}>{worker.captureStatus}</span></div>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Exact-source capture</dt><dd className="font-medium">ENABLED</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Pre-generation exclusion</dt><dd className="font-medium">ENABLED</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Fallback re-resolution</dt><dd className="font-medium">ENABLED</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Last successful capture</dt><dd className="font-medium">{time(worker.captureLastSuccessAt)}</dd></div>
          </dl>
          {worker.captureLastError ? <p className="mt-4 rounded-md border border-red-500/30 bg-red-500/5 p-3 text-xs text-red-700">{worker.captureLastError}</p> : null}
        </div>
      </div>
    </section>)}
  </div>;
}
