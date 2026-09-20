"use client";

import { useEffect, useState } from "react";

type Sample = {
  attemptId: string;
  imageUrl: string;
  instruction: string;
};

export function CalibrationReviewer() {
  const [reviewerKey, setReviewerKey] = useState("");
  const [sample, setSample] = useState<Sample | null>(null);
  const [overall, setOverall] = useState("");
  const [hairstyle, setHairstyle] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("Loading…");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setReviewerKey(sessionStorage.getItem("rnd-calibration-reviewer") ?? "");
    void loadSample();
  }, []);

  async function loadSample() {
    setStatus("Loading next blind sample…");
    const response = await fetch("/api/rnd/qa-calibration/review", {
      cache: "no-store",
    });
    const body = await response.json();
    if (!response.ok) {
      setStatus(body?.error ?? "Unable to load sample.");
      return;
    }
    if (!body.available) {
      setSample(null);
      setStatus("No eligible HUMAN_APPROVAL samples are currently available.");
      return;
    }
    setSample({
      attemptId: body.attemptId,
      imageUrl: body.imageUrl,
      instruction: body.instruction,
    });
    setOverall("");
    setHairstyle("");
    setNotes("");
    setStatus("");
  }

  async function submit() {
    if (!sample || !reviewerKey.trim()) {
      setStatus("Enter a reviewer key before submitting.");
      return;
    }
    const humanOverallScore = Number(overall);
    const humanHairstyleScore = hairstyle.trim() ? Number(hairstyle) : null;
    if (!Number.isFinite(humanOverallScore) || humanOverallScore < 0 || humanOverallScore > 10) {
      setStatus("Overall score must be between 0 and 10.");
      return;
    }
    if (
      humanHairstyleScore !== null &&
      (!Number.isFinite(humanHairstyleScore) || humanHairstyleScore < 0 || humanHairstyleScore > 10)
    ) {
      setStatus("Hairstyle score must be between 0 and 10.");
      return;
    }

    setSaving(true);
    setStatus("Saving blind rating…");

    const response = await fetch("/api/rnd/qa-calibration/review", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        attemptId: sample.attemptId,
        reviewerKey: reviewerKey.trim(),
        humanOverallScore,
        humanHairstyleScore,
        notes: notes.trim() || null,
      }),
    });
    const body = await response.json();

    if (!response.ok) {
      setStatus(body?.error ?? "Unable to save rating.");
      setSaving(false);
      return;
    }

    sessionStorage.setItem("rnd-calibration-reviewer", reviewerKey.trim());
    setSaving(false);
    await loadSample();
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-lg font-semibold">Blind reviewer identity</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Use a stable reviewer key for the same human across all samples. Do not share keys between reviewers.
        </p>
        <input
          value={reviewerKey}
          onChange={(event) => setReviewerKey(event.target.value)}
          placeholder="Reviewer A"
          className="mt-3 w-full max-w-sm rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
      </div>

      {sample ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="mb-3 text-sm text-muted-foreground">
              Requested objective: <span className="font-medium text-foreground">{sample.instruction}</span>
            </div>
            <div className="overflow-hidden rounded-lg bg-muted">
              <img
                src={sample.imageUrl}
                alt="Generated hairstyle for blind QA review"
                className="mx-auto max-h-[75vh] w-auto max-w-full object-contain"
              />
            </div>
          </div>

          <div className="h-fit rounded-xl border border-border bg-card p-5">
            <h2 className="text-lg font-semibold">Blind rating</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Rate the visible result independently. The automated QA score and verdict are intentionally hidden.
            </p>

            <label className="mt-5 block text-sm font-medium">
              Overall quality (0–10)
              <input
                type="number"
                min="0"
                max="10"
                step="0.1"
                value={overall}
                onChange={(event) => setOverall(event.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2"
              />
            </label>

            <label className="mt-4 block text-sm font-medium">
              Hairstyle accuracy (0–10)
              <input
                type="number"
                min="0"
                max="10"
                step="0.1"
                value={hairstyle}
                onChange={(event) => setHairstyle(event.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2"
              />
            </label>

            <label className="mt-4 block text-sm font-medium">
              Notes
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={5}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2"
                placeholder="Concrete visible defects or observations."
              />
            </label>

            <button
              type="button"
              disabled={saving}
              onClick={submit}
              className="mt-5 w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {saving ? "Saving…" : "Submit blind rating"}
            </button>
          </div>
        </div>
      ) : null}

      <div className="text-sm text-muted-foreground">{status}</div>
    </div>
  );
}
