"use client";

import { useState } from "react";

export default function ImportProductionPromptsPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string>("");

  const migrate = async () => {
    setLoading(true);
    setResult("");
    const response = await fetch("/api/dashboard/admin/content/migrate-prompts", { method: "POST" });
    const data = await response.json();
    setLoading(false);

    if (!response.ok) {
      setResult(data.error ?? "Migration failed.");
      return;
    }

    setResult(`Imported ${data.created} production prompts. ${data.skipped} were already present.`);
  };

  return (
    <section className="mx-auto max-w-2xl space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-muted">Admin / Content Library</p>
        <h1 className="mt-2 text-3xl font-semibold text-brand-ink">Import Existing Production Prompts</h1>
        <p className="mt-3 text-brand-muted">
          This copies the existing compiled production hairstyle prompts into the database as version 1 records.
          Prompt text is preserved verbatim. Existing database prompt records are never overwritten.
        </p>
      </div>

      <div className="rounded-xl border border-brand-border bg-brand-surface p-6">
        <p className="text-sm text-brand-muted">
          Imported prompts are marked QA_PASSED and active so the generation engine can use them immediately.
          The operation is idempotent: running it again will skip prompts that already exist.
        </p>
        <button
          type="button"
          onClick={() => void migrate()}
          disabled={loading}
          className="mt-5 rounded-lg bg-brand-ink px-5 py-3 text-sm font-medium text-white disabled:opacity-50"
        >
          {loading ? "Importing…" : "Import Production Prompts"}
        </button>
        {result && <p className="mt-4 rounded-lg border border-brand-border bg-white px-4 py-3 text-sm text-brand-ink">{result}</p>}
      </div>

      <a href="/dashboard/admin/content" className="text-sm text-brand-muted underline">
        Back to Content Library
      </a>
    </section>
  );
}
