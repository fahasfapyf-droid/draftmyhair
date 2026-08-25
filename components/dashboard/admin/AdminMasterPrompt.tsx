"use client";

import { useEffect, useMemo, useState } from "react";

type Version = {
  id: string;
  version: number;
  prompt: string;
  status: string;
  qaStatus: string;
  environment: string;
  notes: string | null;
  createdAt?: string;
  updatedAt?: string;
};

type ApiData = {
  environment: "PREVIEW";
  compiled: Version;
  activeVersion: Version | null;
  versions: Version[];
};

async function json<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "Request failed.");
  return data as T;
}

const statusLabel = (value: string) => value === "COMPILED" ? "COMPILED" : value;

export function AdminMasterPrompt() {
  const [data, setData] = useState<ApiData | null>(null);
  const [selectedId, setSelectedId] = useState("compiled:v3-single");
  const [prompt, setPrompt] = useState("");
  const [notes, setNotes] = useState("");
  const [qaStatus, setQaStatus] = useState("DRAFT");
  const [status, setStatus] = useState("DRAFT");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const selected = useMemo(() => {
    if (!data) return null;
    if (selectedId === data.compiled.id) return data.compiled;
    return data.versions.find((version) => version.id === selectedId) ?? null;
  }, [data, selectedId]);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const next = await json<ApiData>("/api/dashboard/admin/master-prompts", { cache: "no-store" });
      setData(next);
      setSelectedId((current) => current === "compiled:v3-single" || next.versions.some((version) => version.id === current) ? current : next.activeVersion?.id ?? next.compiled.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load master prompts.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  useEffect(() => {
    if (!selected) return;
    setPrompt(selected.prompt);
    setNotes(selected.notes ?? "");
    setQaStatus(selected.qaStatus === "PASSED" && selected.status === "COMPILED" ? "PASSED" : selected.qaStatus);
    setStatus(selected.status === "COMPILED" ? "DRAFT" : selected.status);
  }, [selected]);

  const createVersion = async (activate: boolean) => {
    if (!prompt.trim()) {
      setError("Master prompt cannot be empty.");
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await json("/api/dashboard/admin/master-prompts", {
        method: "POST",
        body: JSON.stringify({ prompt, notes, qaStatus, status: activate ? "ACTIVE" : status }),
      });
      await load();
      setNotice(activate ? "Preview master prompt activated." : "Preview master prompt version created as draft.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to create master prompt version.");
    } finally {
      setSaving(false);
    }
  };

  const updateVersion = async (nextStatus?: string) => {
    if (!selected || selected.id.startsWith("compiled:")) return;
    if (!prompt.trim()) {
      setError("Master prompt cannot be empty.");
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await json(`/api/dashboard/admin/master-prompts/${selected.id}`, {
        method: "PATCH",
        body: JSON.stringify({ prompt, notes, qaStatus, status: nextStatus ?? status }),
      });
      await load();
      setNotice(nextStatus === "ACTIVE" ? "Preview master prompt activated." : "Master prompt version saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save master prompt version.");
    } finally {
      setSaving(false);
    }
  };

  const deleteVersion = async () => {
    if (!selected || selected.id.startsWith("compiled:")) return;
    if (!window.confirm(`Delete v${selected.version}? This cannot be undone.`)) return;
    setSaving(true);
    setError("");
    try {
      await json(`/api/dashboard/admin/master-prompts/${selected.id}`, { method: "DELETE" });
      setSelectedId("compiled:v3-single");
      await load();
      setNotice("Master prompt version deleted.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to delete master prompt version.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="rounded-editorial border border-brand-border bg-brand-surface p-8">Loading master prompt system…</div>;

  return (
    <div className="space-y-6">
      <div className="rounded-editorial border border-brand-border bg-brand-surface p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-brand-ink">Master Prompt</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-brand-muted">
              Control the global image-preservation layer independently from hairstyle prompts. This is Preview-only: active versions here are used only by Preview generations; production continues using the compiled master prompt until a deliberate production promotion.
            </p>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">PREVIEW ENVIRONMENT</div>
        </div>
      </div>

      {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div> : null}
      {notice ? <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">{notice}</div> : null}

      <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="rounded-editorial border border-brand-border bg-brand-surface p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between"><h3 className="font-semibold text-brand-ink">Versions</h3><span className="text-xs text-brand-muted">Preview</span></div>
          <button onClick={() => setSelectedId(data?.compiled.id ?? "compiled:v3-single")} className={`mb-2 w-full rounded-lg border px-3 py-3 text-left ${selectedId === data?.compiled.id ? "border-brand-ink bg-brand-ink text-white" : "border-brand-border text-brand-ink hover:bg-brand-background"}`}>
            <div className="flex items-center justify-between gap-2"><span className="font-semibold">v3-single</span><span className="text-[10px] font-semibold">COMPILED</span></div>
            <div className="mt-1 text-xs opacity-75">Source-controlled baseline</div>
          </button>
          {data?.versions.map((version) => (
            <button key={version.id} onClick={() => setSelectedId(version.id)} className={`mb-2 w-full rounded-lg border px-3 py-3 text-left ${selectedId === version.id ? "border-brand-ink bg-brand-ink text-white" : "border-brand-border text-brand-ink hover:bg-brand-background"}`}>
              <div className="flex items-center justify-between gap-2"><span className="font-semibold">v{version.version}</span><span className="text-[10px] font-semibold">{statusLabel(version.status)}</span></div>
              <div className="mt-1 text-xs opacity-75">QA: {version.qaStatus}</div>
            </button>
          ))}
        </aside>

        <section className="rounded-editorial border border-brand-border bg-brand-surface p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-brand-ink">{selected?.id.startsWith("compiled:") ? "Compiled v3-single baseline" : `Master Prompt v${selected?.version}`}</h3>
              <p className="mt-1 text-sm text-brand-muted">Global rules: identity, face, skin, ears, pose, framing, zoom, camera, clothing, jewelry/accessories, lighting and realism.</p>
            </div>
            {data?.activeVersion ? <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs font-semibold text-green-800">Active Preview: v{data.activeVersion.version}</div> : <div className="rounded-lg border border-brand-border bg-brand-background px-3 py-2 text-xs font-semibold text-brand-muted">No Preview DB override</div>}
          </div>

          <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
            <strong>Safe rollout:</strong> editing the compiled baseline never changes it. Save a new version, test it in Preview, then activate it for Preview generations. Production is isolated by environment.
          </div>

          <label className="mt-6 block text-sm font-semibold text-brand-ink">Master prompt text</label>
          <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} spellCheck={false} className="mt-2 min-h-[620px] w-full rounded-xl border border-brand-border bg-white p-4 font-mono text-xs leading-5 text-brand-ink outline-none focus:border-brand-ink" />

          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <label className="text-sm font-semibold text-brand-ink">QA status<select value={qaStatus} onChange={(e) => setQaStatus(e.target.value)} className="mt-2 block w-full rounded-lg border border-brand-border px-3 py-2 text-sm font-normal"><option>DRAFT</option><option>TESTING</option><option>PASSED</option></select></label>
            <label className="text-sm font-semibold text-brand-ink">Version status<select value={status} onChange={(e) => setStatus(e.target.value)} disabled={selected?.id.startsWith("compiled:")} className="mt-2 block w-full rounded-lg border border-brand-border px-3 py-2 text-sm font-normal"><option>DRAFT</option><option>ACTIVE</option><option>ARCHIVED</option></select></label>
            <label className="text-sm font-semibold text-brand-ink">Notes<input value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-2 block w-full rounded-lg border border-brand-border px-3 py-2 text-sm font-normal" placeholder="Why this version changed" /></label>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            {selected?.id.startsWith("compiled:") ? <button disabled={saving} onClick={() => void createVersion(false)} className="rounded-lg bg-brand-ink px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Saving…" : "Create Draft Version"}</button> : <>
              <button disabled={saving} onClick={() => void updateVersion()} className="rounded-lg bg-brand-ink px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Saving…" : "Save Version"}</button>
              <button disabled={saving} onClick={() => void updateVersion("ACTIVE")} className="rounded-lg border border-brand-border px-4 py-2 text-sm font-semibold text-brand-ink disabled:opacity-50">Activate in Preview</button>
              <button disabled={saving} onClick={() => void deleteVersion()} className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-50">Delete</button>
            </>}
            {selected?.id.startsWith("compiled:") ? <button disabled={saving} onClick={() => void createVersion(true)} className="rounded-lg border border-green-300 bg-green-50 px-4 py-2 text-sm font-semibold text-green-800 disabled:opacity-50">Create + Activate Preview</button> : null}
          </div>
        </section>
      </div>
    </div>
  );
}
