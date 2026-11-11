"use client";

import { useState } from "react";

const JOB_ID = "rndproto2-italian-bob-20261110-a3";
const TARGET_KEY = "rnd-protocol2-italian-bob-fresh-20261110-01";

export function RndRecoveredArtifactForm() {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function submit() {
    if (!file || busy) return;
    setBusy(true);
    setResult(null);
    try {
      const form = new FormData();
      form.set("jobId", JOB_ID);
      form.set("attemptNumber", "4");
      form.set("targetKey", TARGET_KEY);
      form.set("file", file);
      const response = await fetch("/api/rnd/admin/reconcile-attempt4", { method: "POST", body: form });
      const body = await response.json().catch(() => ({}));
      setResult(JSON.stringify({ status: response.status, ...body }, null, 2));
    } catch (error) {
      setResult(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="max-w-3xl space-y-5 rounded-xl border border-amber-300 bg-white p-6 shadow-sm">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-gray-900">Recover interrupted Gemini result - Attempt 4</h2>
        <p className="text-sm text-gray-600">This administrator-only action attaches the checksum-pinned result from the confirmed Gemini conversation to Attempt 4, verifies the source and duplicate checksums, then runs the existing automated QA pipeline. It does not start a generation.</p>
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div><dt className="text-gray-500">Job</dt><dd className="break-all font-mono text-gray-800">{JOB_ID}</dd></div>
          <div><dt className="text-gray-500">Attempt</dt><dd className="font-mono text-gray-800">4</dd></div>
          <div className="sm:col-span-2"><dt className="text-gray-500">Target</dt><dd className="break-all font-mono text-gray-800">{TARGET_KEY}</dd></div>
        </dl>
      </div>
      <label className="block space-y-2 text-sm font-medium text-gray-800">
        Existing Gemini-generated JPEG
        <input type="file" accept="image/jpeg,image/png,image/webp" onChange={event => { setFile(event.target.files?.[0] ?? null); setResult(null); }} className="block w-full rounded-lg border border-gray-300 p-3 text-sm" />
      </label>
      {file && <p className="text-xs text-gray-600">{file.name} Â· {file.size.toLocaleString()} bytes Â· {file.type}</p>}
      <button type="button" disabled={!file || busy} onClick={submit} className="rounded-lg bg-gray-900 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
        {busy ? "Reconciling and running QAâ€¦" : "Reconcile existing image and run QA"}
      </button>
      <p className="text-xs text-amber-800">Only select the recovered Gemini image with the expected checksum. Do not select a browser screenshot. Do not submit twice while a request is processing.</p>
      {result && <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-gray-100 p-4 text-xs text-gray-800">{result}</pre>}
    </section>
  );
}


