"use client";

import { useEffect, useState } from "react";

type Sample = { attemptId: string; imageUrl: string; instruction: string; receiptToken: string };

export function CalibrationReviewer() {
  const [sample, setSample] = useState<Sample | null>(null);
  const [overall, setOverall] = useState("");
  const [hairstyle, setHairstyle] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("Loading…");
  const [saving, setSaving] = useState(false);

  useEffect(() => () => { if (sample?.imageUrl) URL.revokeObjectURL(sample.imageUrl); }, [sample?.imageUrl]);

  async function loadSample() {
    setStatus("Loading next blind sample…");
    const response = await fetch("/api/rnd/qa-calibration/review", { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) { setStatus(body?.code ?? "Unable to load sample."); return; }
    if (!body.available) { setSample(null); setStatus("No eligible HUMAN_APPROVAL samples are currently available."); return; }

    const imageResponse = await fetch(body.imageUrl, { cache: "no-store" });
    const receiptToken = imageResponse.headers.get("x-rnd-review-receipt");
    if (!imageResponse.ok || !receiptToken) { setSample(null); setStatus("Image integrity verification failed. This sample cannot be rated."); return; }
    const imageUrl = URL.createObjectURL(await imageResponse.blob());
    setSample({ attemptId: body.attemptId, imageUrl, instruction: body.instruction, receiptToken });
    setOverall(""); setHairstyle(""); setNotes(""); setStatus("");
  }

  async function submit() {
    if (!sample) { setStatus("Load and view a verified sample before submitting."); return; }
    const humanOverallScore = Number(overall);
    const humanHairstyleScore = hairstyle.trim() ? Number(hairstyle) : null;
    if (!Number.isFinite(humanOverallScore) || humanOverallScore < 0 || humanOverallScore > 10) { setStatus("Overall score must be between 0 and 10."); return; }
    if (humanHairstyleScore !== null && (!Number.isFinite(humanHairstyleScore) || humanHairstyleScore < 0 || humanHairstyleScore > 10)) { setStatus("Hairstyle score must be between 0 and 10."); return; }

    setSaving(true); setStatus("Saving blind rating…");
    const response = await fetch("/api/rnd/qa-calibration/review", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ attemptId: sample.attemptId, receiptToken: sample.receiptToken, humanOverallScore, humanHairstyleScore, notes: notes.trim() || null }),
    });
    const body = await response.json();
    if (!response.ok) { setStatus(body?.code ?? "Unable to save rating."); setSaving(false); return; }
    setSaving(false); await loadSample();
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-lg font-semibold">Authenticated blind reviewer</h2>
        <p className="mt-1 text-sm text-muted-foreground">Your signed-in ADMIN identity is recorded automatically. Each sample must be loaded through the integrity-checked image endpoint before it can be rated.</p>
        <button type="button" onClick={() => void loadSample()} className="mt-3 rounded-md border border-border bg-background px-4 py-2 text-sm font-medium">Load next sample</button>
      </div>

      {sample ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="mb-3 text-sm text-muted-foreground">Requested objective: <span className="font-medium text-foreground">{sample.instruction}</span></div>
            <div className="overflow-hidden rounded-lg bg-muted"><img src={sample.imageUrl} alt="Generated hairstyle for blind QA review" className="mx-auto max-h-[75vh] w-auto max-w-full object-contain" /></div>
          </div>
          <div className="h-fit rounded-xl border border-border bg-card p-5">
            <h2 className="text-lg font-semibold">Blind rating</h2>
            <p className="mt-1 text-sm text-muted-foreground">Rate the verified visible result independently. Automated QA scores and verdicts remain hidden.</p>
            <label className="mt-5 block text-sm font-medium">Overall quality (0–10)<input type="number" min="0" max="10" step="0.1" value={overall} onChange={event => setOverall(event.target.value)} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2" /></label>
            <label className="mt-4 block text-sm font-medium">Hairstyle accuracy (0–10)<input type="number" min="0" max="10" step="0.1" value={hairstyle} onChange={event => setHairstyle(event.target.value)} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2" /></label>
            <label className="mt-4 block text-sm font-medium">Notes<textarea value={notes} onChange={event => setNotes(event.target.value)} rows={5} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2" placeholder="Concrete visible defects or observations." /></label>
            <button type="button" disabled={saving} onClick={() => void submit()} className="mt-5 w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">{saving ? "Saving…" : "Submit blind rating"}</button>
          </div>
        </div>
      ) : null}
      <div className="text-sm text-muted-foreground">{status}</div>
    </div>
  );
}
