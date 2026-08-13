"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { saveGenerationQa } from "@/app/actions/admin/generation-qa-actions";

function Stars({ name, label, value }: { name: string; label: string; value?: number }) {
  const [selected, setSelected] = useState(value ?? 0);

  return (
    <fieldset>
      <legend className="text-xs font-medium text-brand-muted">{label}</legend>
      <div className="mt-1 flex gap-1">
        {[1, 2, 3, 4, 5].map((rating) => {
          const active = rating <= selected;

          return (
            <label
              key={rating}
              className="cursor-pointer rounded p-0.5 focus-within:outline-none focus-within:ring-2 focus-within:ring-brand-ink focus-within:ring-offset-1"
            >
              <input
                className="sr-only"
                type="radio"
                name={name}
                value={rating}
                checked={selected === rating}
                onChange={() => setSelected(rating)}
                required
                aria-label={`${rating} out of 5 stars`}
              />
              <span
                className={`text-lg transition-colors ${
                  active ? "text-brand-ink" : "text-brand-border"
                }`}
                aria-hidden="true"
              >
                ★
              </span>
            </label>
          );
        })}
      </div>
      {selected > 0 && (
        <p className="mt-1 text-xs text-brand-muted">
          Current QA rating: {selected}/5
        </p>
      )}
    </fieldset>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      disabled={pending}
      className="rounded-editorial bg-brand-ink px-4 py-2 text-xs font-medium text-brand-canvas disabled:opacity-50"
    >
      {pending ? "Saving…" : "Save QA"}
    </button>
  );
}

export function GenerationQaForm({
  generationId,
  qa,
}: {
  generationId: string;
  qa?: {
    overall?: number;
    identity?: number;
    integration?: number;
    realism?: number;
    notes?: string | null;
  };
}) {
  const action = saveGenerationQa.bind(null, generationId);

  return (
    <form action={action} className="mt-4 rounded-editorial border border-brand-border bg-brand-canvas p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-muted">Internal QA</p>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <Stars name="overall" label="Overall QA" value={qa?.overall} />
        <Stars name="identity" label="Identity preservation" value={qa?.identity} />
        <Stars name="integration" label="Hair integration" value={qa?.integration} />
        <Stars name="realism" label="Photorealism" value={qa?.realism} />
      </div>
      <textarea
        name="notes"
        defaultValue={qa?.notes ?? ""}
        maxLength={1000}
        rows={2}
        placeholder="Optional QA notes…"
        className="mt-4 w-full rounded border border-brand-border bg-brand-surface px-3 py-2 text-xs text-brand-ink outline-none focus:border-brand-ink"
      />
      <div className="mt-3">
        <Submit />
      </div>
    </form>
  );
}
