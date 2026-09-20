"use client";

import { useEffect, useMemo, useState } from "react";

type Source = {
  id: string;
  originalFilename: string | null;
  displayName: string | null;
  genderPresentation: string | null;
  cohortLabel: string | null;
  hairTexture: string | null;
  hairLength: string | null;
  notes: string | null;
  createdAt: string;
};

type Style = {
  id: string;
  name: string;
  slug: string;
  serviceType: string;
  gender: string;
  category: string | null;
};

const labels: Record<string, string> = {
  HAIRSTYLE: "Hairstyles",
  HAIR_COLOR: "Hair Color",
  BUZZ_CUT: "Buzz Cut",
  BALD: "Bald",
  BEARD: "Beard",
  BEARD_REMOVAL: "Beard Removal",
};

export function RndRunBuilder() {
  const [sources, setSources] = useState<Source[]>([]);
  const [styles, setStyles] = useState<Style[]>([]);
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [filter, setFilter] = useState("");
  const [cohort, setCohort] = useState("");
  const [runName, setRunName] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);

  const [displayName, setDisplayName] = useState("");
  const [genderPresentation, setGenderPresentation] = useState("");
  const [cohortLabel, setCohortLabel] = useState("");
  const [hairTexture, setHairTexture] = useState("");
  const [hairLength, setHairLength] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);

  async function load() {
    const [s, t] = await Promise.all([
      fetch("/api/rnd/dashboard/sources", { cache: "no-store" }),
      fetch("/api/rnd/dashboard/run", { cache: "no-store" }),
    ]);
    const sb = await s.json();
    const tb = await t.json();
    setSources(Array.isArray(sb.sources) ? sb.sources : []);
    setStyles(Array.isArray(tb.styles) ? tb.styles : []);
  }

  useEffect(() => { void load(); }, []);

  const filteredSources = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return sources.filter((s) => {
      const text = [s.displayName, s.originalFilename, s.genderPresentation, s.cohortLabel, s.hairTexture, s.hairLength].filter(Boolean).join(" ").toLowerCase();
      return (!q || text.includes(q)) && (!cohort || s.cohortLabel === cohort);
    });
  }, [sources, filter, cohort]);

  const cohorts = useMemo(
    () => Array.from(new Set(sources.map((s) => s.cohortLabel).filter(Boolean) as string[])).sort(),
    [sources],
  );

  const groupedStyles = useMemo(() => {
    const groups = new Map<string, Style[]>();
    for (const style of styles) {
      const key = labels[style.serviceType] ?? style.serviceType;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(style);
    }
    return Array.from(groups.entries());
  }, [styles]);

  async function uploadSource() {
    if (!file) return;
    setBusy(true);
    setNotice("Uploading source photo…");
    try {
      const form = new FormData();
      form.set("image", file);
      form.set("displayName", displayName);
      form.set("genderPresentation", genderPresentation);
      form.set("cohortLabel", cohortLabel);
      form.set("hairTexture", hairTexture);
      form.set("hairLength", hairLength);
      form.set("notes", notes);
      const response = await fetch("/api/rnd/dashboard/sources", { method: "POST", body: form });
      const body = await response.json();
      if (!response.ok) { setNotice(body?.error ?? "Upload failed."); return; }
      setNotice("Source photo added to the library.");
      setFile(null); setDisplayName(""); setGenderPresentation(""); setCohortLabel(""); setHairTexture(""); setHairLength(""); setNotes(""); setUploadOpen(false);
      await load();
    } catch {
      setNotice("Upload failed.");
    } finally { setBusy(false); }
  }

  async function startRun() {
    if (!selectedStyles.length || !selectedSources.length) return;
    setBusy(true);
    setNotice("Building R&D run and queuing jobs…");
    try {
      const response = await fetch("/api/rnd/dashboard/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ styleIds: selectedStyles, sourceAssetIds: selectedSources, name: runName }),
      });
      const body = await response.json();
      if (!response.ok) { setNotice(body?.error ?? "Could not start R&D run."); return; }
      setNotice(body.message ?? "R&D run started.");
      setSelectedStyles([]); setSelectedSources([]); setRunName("");
    } catch {
      setNotice("Could not start R&D run.");
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-6">
      {notice ? <div className="rounded-lg border border-border bg-card p-4 text-sm">{notice}</div> : null}

      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Source Photo Library</h2>
            <p className="mt-1 text-sm text-muted-foreground">Reusable test photos. Cohort labels are curator-provided; the system does not infer them from the image.</p>
          </div>
          <button onClick={() => setUploadOpen((v) => !v)} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
            {uploadOpen ? "Close" : "Add source photo"}
          </button>
        </div>

        {uploadOpen ? (
          <div className="mt-5 grid gap-3 rounded-lg border border-border p-4 md:grid-cols-2">
            <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="md:col-span-2 text-sm" />
            {[
              ["Display name", displayName, setDisplayName],
              ["Gender presentation", genderPresentation, setGenderPresentation],
              ["Cohort / demographic label", cohortLabel, setCohortLabel],
              ["Hair texture", hairTexture, setHairTexture],
              ["Natural hair length", hairLength, setHairLength],
            ].map(([label, value, setter]) => (
              <input key={label as string} placeholder={label as string} value={value as string} onChange={(e) => (setter as (v: string) => void)(e.target.value)} className="rounded-md border border-border bg-background px-3 py-2 text-sm" />
            ))}
            <textarea placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} className="md:col-span-2 rounded-md border border-border bg-background px-3 py-2 text-sm" />
            <button disabled={!file || busy} onClick={() => void uploadSource()} className="rounded-md border border-border px-4 py-2 text-sm font-semibold disabled:opacity-50 md:col-span-2">
              Upload source
            </button>
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap gap-2">
          <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search source photos…" className="min-w-64 flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm" />
          <select value={cohort} onChange={(e) => setCohort(e.target.value)} className="rounded-md border border-border bg-background px-3 py-2 text-sm">
            <option value="">All cohorts</option>
            {cohorts.map((x) => <option key={x}>{x}</option>)}
          </select>
          <button onClick={() => setSelectedSources(filteredSources.map((s) => s.id))} className="rounded-md border border-border px-3 py-2 text-sm">Select visible</button>
          <button onClick={() => setSelectedSources([])} className="rounded-md border border-border px-3 py-2 text-sm">Clear</button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {filteredSources.map((source) => {
            const checked = selectedSources.includes(source.id);
            return (
              <button key={source.id} onClick={() => setSelectedSources((v) => checked ? v.filter((id) => id !== source.id) : [...v, source.id])} className={`overflow-hidden rounded-lg border text-left ${checked ? "border-primary ring-2 ring-primary/20" : "border-border"}`}>
                <img src={`/api/rnd/dashboard/sources/image?assetId=${encodeURIComponent(source.id)}`} alt="" className="aspect-[4/5] w-full object-cover" />
                <div className="p-3 text-xs">
                  <div className="font-semibold">{source.displayName || source.originalFilename || "Source photo"}</div>
                  <div className="mt-1 text-muted-foreground">{[source.genderPresentation, source.cohortLabel, source.hairTexture, source.hairLength].filter(Boolean).join(" · ") || "No metadata"}</div>
                </div>
              </button>
            );
          })}
        </div>
        {!filteredSources.length ? <p className="mt-4 text-sm text-muted-foreground">No source photos yet. Add the first one above.</p> : null}
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-lg font-semibold">R&D Targets</h2>
        <p className="mt-1 text-sm text-muted-foreground">Select styles/services. Each selected target will run against every selected source photo.</p>
        <div className="mt-5 space-y-5">
          {groupedStyles.map(([group, groupStyles]) => (
            <div key={group}>
              <h3 className="mb-2 text-sm font-semibold">{group}</h3>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {groupStyles.map((style) => {
                  const checked = selectedStyles.includes(style.id);
                  return (
                    <label key={style.id} className={`flex cursor-pointer items-center gap-3 rounded-md border p-3 text-sm ${checked ? "border-primary bg-primary/5" : "border-border"}`}>
                      <input type="checkbox" checked={checked} onChange={() => setSelectedStyles((v) => checked ? v.filter((id) => id !== style.id) : [...v, style.id])} />
                      <span>{style.name}</span>
                      <span className="ml-auto text-xs text-muted-foreground">{style.gender}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="sticky bottom-4 rounded-xl border border-border bg-card p-5 shadow-lg">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="flex-1 text-sm">
            <div className="font-semibold">{selectedStyles.length} styles × {selectedSources.length} source photos</div>
            <div className="text-muted-foreground">{selectedStyles.length * selectedSources.length} jobs will be queued.</div>
          </div>
          <input value={runName} onChange={(e) => setRunName(e.target.value)} placeholder="Run name (optional)" className="rounded-md border border-border bg-background px-3 py-2 text-sm" />
          <button disabled={busy || !selectedStyles.length || !selectedSources.length} onClick={() => void startRun()} className="rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50">
            {busy ? "Starting…" : "START R&D RUN"}
          </button>
        </div>
      </section>
    </div>
  );
}
