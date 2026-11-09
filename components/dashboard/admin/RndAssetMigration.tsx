"use client";

import { useState } from "react";

type MigrationResult = {
  ok?: boolean;
  migratedCount?: number;
  destinationStore?: string;
  sourceObjectsPreserved?: boolean;
  assets?: Array<{ id: string; checksum: string; size: number }>;
  error?: string;
  assetId?: string;
};

export function RndAssetMigration() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<MigrationResult | null>(null);

  async function migrate() {
    const confirmed = window.confirm(
      "Copy the 3 existing R&D assets from dmh-prompt-lab to dmh-rnd-artifacts? The action verifies SHA-256 checksums and read-back before updating the 3 database URLs. Original Prompt Lab objects are preserved. No jobs or workers are started."
    );
    if (!confirmed) return;

    setBusy(true);
    setResult(null);
    try {
      const response = await fetch("/api/rnd/admin/migrate-legacy-assets", {
        method: "POST",
        cache: "no-store",
      });
      const body = (await response.json()) as MigrationResult;
      setResult(body);
      if (!response.ok) {
        setResult({ ...body, ok: false, error: body.error ?? `Migration failed (HTTP ${response.status}).` });
      }
    } catch (error) {
      setResult({
        ok: false,
        error: error instanceof Error ? error.message : "Migration request failed.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-amber-300 bg-amber-50 p-5 text-amber-950">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-semibold">R&D Asset Store Migration</h2>
          <p className="mt-1 max-w-3xl text-sm">
            Copy the three legacy R&D assets into the isolated dmh-rnd-artifacts store.
            The migration verifies source and destination SHA-256 checksums and preserves
            the original Prompt Lab objects. It does not start the worker or change job status.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void migrate()}
          disabled={busy}
          className="inline-flex shrink-0 items-center justify-center rounded-lg bg-amber-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Migrating and verifying…" : "Migrate R&D Assets"}
        </button>
      </div>

      {result ? (
        <div className="mt-4 rounded-lg border border-amber-300 bg-white p-4 text-sm">
          {result.ok ? (
            <>
              <p className="font-semibold text-green-800">Migration verified</p>
              <p className="mt-1">
                {result.migratedCount} assets copied and read-back verified in {result.destinationStore}.
                Original source objects preserved.
              </p>
              <ul className="mt-2 space-y-1 font-mono text-xs">
                {(result.assets ?? []).map((asset) => (
                  <li key={asset.id}>{asset.id} · {asset.size} bytes · SHA-256 {asset.checksum}</li>
                ))}
              </ul>
            </>
          ) : (
            <>
              <p className="font-semibold text-red-800">Migration not completed</p>
              <p className="mt-1">{result.error ?? "The migration endpoint returned an error."}</p>
              {result.assetId ? <p className="mt-1 font-mono text-xs">Asset: {result.assetId}</p> : null}
            </>
          )}
        </div>
      ) : null}
    </section>
  );
}
