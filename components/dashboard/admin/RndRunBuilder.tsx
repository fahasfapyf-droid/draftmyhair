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
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [assigningStyle, setAssigningStyle] = useState<string | null>(null);
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [filter, setFilter] = useState("");
  const [cohort, setCohort] = useState("");
  const [runName, setRunName] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [metadataOpen, setMetadataOpen] = useState(false);

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
    const runAssignments = Object.entries(assignments).filter(([, sourceId]) => Boolean(sourceId)).map(([styleId, sourceAssetId]) => ({ styleId, sourceAssetId }));
    if (!runAssignments.length) return;
    setBusy(true);
    setNotice("Building R&D run and queuing jobs…");
    try {
      const response = await fetch("/api/rnd/dashboard/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ assignments: runAssignments, name: runName }),
      });
      const body = await response.json();
      if (!response.ok) { setNotice(body?.error ?? "Could not start R&D run."); return; }
      setNotice(body.message ?? "R&D run started.");
      setSelectedStyles([]); setSelectedSources([]); setAssignments({}); setRunName("");
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
          <div className="mt-5 rounded-lg border border-border bg-background/40 p-4">
            <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Source photo</label>
                <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="block w-full text-sm" />
              </div>
              <button type="button" onClick={() => setMetadataOpen((v) => !v)} className="rounded-md border border-border px-3 py-2 text-sm">
                {metadataOpen ? "Hide metadata" : "Add metadata (optional)"}
              </button>
            </div>

            {metadataOpen ? (
              <div className="mt-4 grid gap-3 border-t border-border pt-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Display name</label>
                  <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Gender presentation</label>
                  <select value={genderPresentation} onChange={(e) => setGenderPresentation(e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
                    <option value="">Select</option>
                    <option value="Feminine">Feminine</option>
                    <option value="Masculine">Masculine</option>
                    <option value="Androgynous / neutral">Androgynous / neutral</option>
                    <option value="Unspecified">Unspecified</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Cohort</label>
                  <select value={cohortLabel} onChange={(e) => setCohortLabel(e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
                    <option value="">Select</option>
                    <option value="Young adult">Young adult</option>
                    <option value="Adult">Adult</option>
                    <option value="Middle-aged adult">Middle-aged adult</option>
                    <option value="Older adult">Older adult</option>
                    <option value="Senior">Senior</option>
                    <option value="Unspecified">Unspecified</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Hair texture</label>
                  <select value={hairTexture} onChange={(e) => setHairTexture(e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
                    <option value="">Select</option>
                    <option value="Straight">Straight</option>
                    <option value="Wavy">Wavy</option>
                    <option value="Curly">Curly</option>
                    <option value="Coily">Coily</option>
                    <option value="Locs / locked">Locs / locked</option>
                    <option value="Unspecified">Unspecified</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Natural hair length</label>
                  <select value={hairLength} onChange={(e) => setHairLength(e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
                    <option value="">Select</option>
                    <option value="Bald / none">Bald / none</option>
                    <option value="Buzz / very short">Buzz / very short</option>
                    <option value="Short">Short</option>
                    <option value="Medium">Medium</option>
                    <option value="Shoulder length">Shoulder length</option>
                    <option value="Long">Long</option>
                    <option value="Very long">Very long</option>
                    <option value="Unspecified">Unspecified</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Notes (optional)</label>
                  <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-20 w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
                </div>
              </div>
            ) : null}

            <button disabled={!file || busy} onClick={() => void uploadSource()} className="mt-4 w-full rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
              {busy ? "Uploading…" : "Upload source photo"}
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
        <p className="mt-1 text-sm text-muted-foreground">Each target gets its own source photo. Existing library photos can be reused, or a new photo can be added above.</p>
        <div className="mt-5 space-y-5">
          {groupedStyles.map(([group, groupStyles]) => (
            <div key={group}>
              <h3 className="mb-2 text-sm font-semibold">{group}</h3>
              <div className="space-y-2">
                {groupStyles.map((style) => {
                  const sourceId = assignments[style.id] ?? "";
                  const source = sources.find((s) => s.id === sourceId);
                  const active = Boolean(sourceId);
                  return (
                    <div key={style.id} className={`rounded-lg border p-3 ${active ? "border-primary bg-primary/5" : "border-border"}`}>
                      <div className="flex flex-wrap items-center gap-3">
                        <input type="checkbox" checked={active} onChange={() => setAssignments((v) => {
                          const next = { ...v };
                          if (next[style.id]) delete next[style.id]; else if (sources[0]) next[style.id] = sources[0].id;
                          return next;
                        })} />
                        <span className="font-medium">{style.name}</span>
                        <span className="text-xs text-muted-foreground">{style.gender}</span>
                        <div className="ml-auto flex items-center gap-2">
                          {active ? (
                            <select value={sourceId} onChange={(e) => setAssignments((v) => ({ ...v, [style.id]: e.target.value }))} className="max-w-xs rounded-md border border-border bg-background px-3 py-2 text-sm">
                              <option value="">Select model photo</option>
                              {sources.map((s) => <option key={s.id} value={s.id}>{s.displayName || s.originalFilename || "Source photo"}{s.genderPresentation ? ` · ${s.genderPresentation}` : ""}</option>)}
                            </select>
                          ) : null}
                          <button type="button" onClick={() => setAssigningStyle(assigningStyle === style.id ? null : style.id)} className="rounded-md border border-border px-3 py-2 text-xs">
                            {active ? "Change photo" : "Select / upload photo"}
                          </button>
                        </div>
                      </div>
                      {active ? <div className="mt-2 pl-8 text-xs text-muted-foreground">Assigned: {source?.displayName || source?.originalFilename || "Source photo"}</div> : null}
                      {assigningStyle === style.id ? (
                        <div className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
                          Choose an existing photo from the dropdown, or use <strong>Add source photo</strong> above to upload a new model. After upload, select it here.
                        </div>
                      ) : null}
                    </div>
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
            <div className="font-semibold">{Object.keys(assignments).filter((id) => assignments[id]).length} targets assigned</div>
            <div className="text-muted-foreground">{Object.values(assignments).filter(Boolean).length} jobs will be queued.</div>
          </div>
          <input value={runName} onChange={(e) => setRunName(e.target.value)} placeholder="Run name (optional)" className="rounded-md border border-border bg-background px-3 py-2 text-sm" />
          <button disabled={busy || !Object.values(assignments).some(Boolean)} onClick={() => void startRun()} className="rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50">
            {busy ? "Starting…" : "START R&D RUN"}
          </button>
        </div>
      </section>
    </div>
  );
}
