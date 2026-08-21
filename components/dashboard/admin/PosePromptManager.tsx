"use client";

import { useEffect, useState } from "react";

type PosePrompt = {
  id: string;
  name: string;
  slug: string;
  version: number;
  prompt: string;
  status: string;
  qaStatus: string;
  notes: string | null;
  createdAt?: string;
  updatedAt?: string;
};

const emptyForm = {
  name: "Strict Pose Lock",
  slug: "strict-pose-lock",
  prompt: "",
  notes: "",
  qaStatus: "DRAFT",
  status: "DRAFT",
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

export function PosePromptManager() {
  const [prompts, setPrompts] = useState<PosePrompt[]>([]);
  const [selected, setSelected] = useState<PosePrompt | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await json<{ prompts: PosePrompt[] }>("/api/dashboard/admin/pose-prompts");
      setPrompts(data.prompts);
      if (!selected && data.prompts[0]) selectPrompt(data.prompts[0]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load pose prompts.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const selectPrompt = (prompt: PosePrompt) => {
    setSelected(prompt);
    setForm({
      name: prompt.name,
      slug: prompt.slug,
      prompt: prompt.prompt,
      notes: prompt.notes ?? "",
      qaStatus: prompt.qaStatus === "COMPILED" ? "PASSED" : prompt.qaStatus,
      status: prompt.status === "COMPILED" ? "DRAFT" : prompt.status,
    });
    setError("");
    setNotice("");
  };

  const save = async () => {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      if (!form.name.trim() || !form.slug.trim() || !form.prompt.trim()) {
        throw new Error("Name, slug and prompt are required.");
      }

      const payload = JSON.stringify(form);
      if (selected && !selected.id.startsWith("compiled:")) {
        await json(`/api/dashboard/admin/pose-prompts/${selected.id}`, { method: "PATCH", body: payload });
        setNotice(`${form.name} v${selected.version} updated.`);
      } else {
        const data = await json<{ prompt: PosePrompt }>("/api/dashboard/admin/pose-prompts", { method: "POST", body: payload });
        setNotice(`${data.prompt.name} v${data.prompt.version} created.`);
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save pose prompt.");
    } finally {
      setSaving(false);
    }
  };

  const createNewVersion = () => {
    if (!selected) return;
    setSelected(null);
    setForm({
      name: selected.name,
      slug: selected.slug,
      prompt: selected.prompt,
      notes: "New pose prompt version.",
      qaStatus: "DRAFT",
      status: "DRAFT",
    });
    setNotice("Editing a new draft version. Save to create it.");
  };

  const deletePrompt = async () => {
    if (!selected || selected.id.startsWith("compiled:")) return;
    if (!window.confirm(`Delete ${selected.name} v${selected.version}?`)) return;
    setError("");
    setNotice("");
    try {
      await json(`/api/dashboard/admin/pose-prompts/${selected.id}`, { method: "DELETE" });
      setSelected(null);
      await load();
      setNotice("Pose prompt version deleted.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to delete pose prompt.");
    }
  };

  if (loading) return <div className="rounded-editorial border border-brand-border bg-brand-surface p-8">Loading pose prompts…</div>;

  return (
    <div className="space-y-6">
      <div className="rounded-editorial border border-brand-border bg-brand-surface p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-brand-ink">Pose Prompts</h2>
            <p className="mt-2 max-w-3xl text-sm text-brand-muted">
              Independently tune pose and camera preservation without editing the master prompt. The existing master geometry lock remains untouched.
            </p>
          </div>
          <button onClick={createNewVersion} disabled={!selected} className="rounded-lg border border-brand-border px-4 py-2 text-sm font-semibold text-brand-ink disabled:opacity-50">+ New Version</button>
        </div>
      </div>

      {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div> : null}
      {notice ? <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">{notice}</div> : null}

      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="rounded-editorial border border-brand-border bg-brand-surface p-4 shadow-sm">
          <h3 className="mb-3 font-semibold text-brand-ink">Versions</h3>
          <div className="space-y-2">
            {prompts.map((prompt) => (
              <button key={prompt.id} onClick={() => selectPrompt(prompt)} className={`w-full rounded-lg border px-3 py-3 text-left ${selected?.id === prompt.id ? "border-brand-ink bg-brand-ink text-white" : "border-brand-border hover:bg-brand-background"}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{prompt.name}</span>
                  <span className="text-xs">v{prompt.version}</span>
                </div>
                <div className="mt-1 text-xs opacity-80">{prompt.status} · QA {prompt.qaStatus}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-editorial border border-brand-border bg-brand-surface p-6 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm font-medium text-brand-ink">Name<input value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})} className="mt-1 w-full rounded-lg border border-brand-border px-3 py-2 font-normal" /></label>
            <label className="text-sm font-medium text-brand-ink">Slug<input value={form.slug} onChange={(e)=>setForm({...form,slug:e.target.value})} className="mt-1 w-full rounded-lg border border-brand-border px-3 py-2 font-normal" /></label>
            <label className="text-sm font-medium text-brand-ink">Status<select value={form.status} onChange={(e)=>setForm({...form,status:e.target.value})} className="mt-1 w-full rounded-lg border border-brand-border px-3 py-2 font-normal"><option value="DRAFT">DRAFT</option><option value="ACTIVE">ACTIVE</option><option value="ARCHIVED">ARCHIVED</option></select></label>
            <label className="text-sm font-medium text-brand-ink">QA Status<select value={form.qaStatus} onChange={(e)=>setForm({...form,qaStatus:e.target.value})} className="mt-1 w-full rounded-lg border border-brand-border px-3 py-2 font-normal"><option value="DRAFT">DRAFT</option><option value="TESTING">TESTING</option><option value="PASSED">PASSED</option></select></label>
          </div>
          <label className="mt-4 block text-sm font-medium text-brand-ink">Pose Prompt<textarea value={form.prompt} onChange={(e)=>setForm({...form,prompt:e.target.value})} rows={18} className="mt-1 w-full rounded-lg border border-brand-border px-3 py-3 font-mono text-sm font-normal leading-6" /></label>
          <label className="mt-4 block text-sm font-medium text-brand-ink">Notes<textarea value={form.notes} onChange={(e)=>setForm({...form,notes:e.target.value})} rows={4} className="mt-1 w-full rounded-lg border border-brand-border px-3 py-2 font-normal" /></label>
          <div className="mt-5 flex flex-wrap gap-3">
            <button onClick={save} disabled={saving} className="rounded-lg bg-brand-ink px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Saving…" : selected && !selected.id.startsWith("compiled:") ? "Save Changes" : "Create Version"}</button>
            {selected && !selected.id.startsWith("compiled:") ? <button onClick={deletePrompt} className="rounded-lg border border-red-200 px-5 py-2.5 text-sm font-semibold text-red-700">Delete Version</button> : null}
          </div>
          <p className="mt-4 text-xs text-brand-muted">The compiled source prompt is read-only. Editing it creates a database version. Only an ACTIVE database version is used by generation; with no active database version, the current generation prompt remains unchanged.</p>
        </div>
      </div>
    </div>
  );
}
