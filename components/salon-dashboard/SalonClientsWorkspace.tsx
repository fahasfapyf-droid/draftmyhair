"use client";

import { useMemo, useState } from "react";
import { ArrowRight, Plus, Search, UserRound } from "lucide-react";

interface Client {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  consentAt: string | Date | null;
  _count: { generations: number };
}

export function SalonClientsWorkspace({ initialClients }: { initialClients: Client[] }) {
  const [clients, setClients] = useState(initialClients);
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return clients;
    return clients.filter((client) =>
      [client.name, client.email ?? "", client.phone ?? ""].some((item) =>
        item.toLowerCase().includes(value)
      )
    );
  }, [clients, query]);

  async function createClient(form: HTMLFormElement) {
    setSaving(true);
    setError(null);
    const data = new FormData(form);

    try {
      const response = await fetch("/api/salon/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.get("name"),
          email: data.get("email"),
          phone: data.get("phone"),
          notes: data.get("notes"),
          consent: data.get("consent") === "on",
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error ?? "Unable to create client.");
      setClients((current) => [result.client, ...current]);
      setShowForm(false);
      form.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create client.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-muted">Client workspace</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-editorial text-brand-ink">Your salon clients</h2>
          <p className="mt-2 text-sm text-brand-muted">Keep each consultation and generated preview attached to the correct client.</p>
        </div>
        <button onClick={() => setShowForm((value) => !value)} className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-ink px-5 py-3 text-sm font-semibold text-white hover:opacity-90">
          <Plus className="h-4 w-4" /> Add client
        </button>
      </div>

      {showForm && (
        <form action={(form) => void createClient(form)} className="rounded-2xl border border-brand-border bg-brand-canvas p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <Field name="name" label="Client name" required />
            <Field name="phone" label="Phone" />
            <Field name="email" label="Email" type="email" />
            <label className="flex items-center gap-3 rounded-xl border border-brand-border px-4 py-3 text-sm text-brand-ink"><input name="consent" type="checkbox" required /> Client consent recorded</label>
            <label className="md:col-span-2"><span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-brand-muted">Notes</span><textarea name="notes" rows={3} className="w-full rounded-xl border border-brand-border bg-white px-4 py-3 text-sm outline-none" placeholder="Consultation notes" /></label>
          </div>
          {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
          <div className="mt-5 flex gap-3">
            <button disabled={saving} type="submit" className="rounded-full bg-brand-ink px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Saving..." : "Save client"}</button>
            <button type="button" onClick={() => setShowForm(false)} className="rounded-full border border-brand-border px-5 py-2.5 text-sm font-semibold text-brand-ink">Cancel</button>
          </div>
        </form>
      )}

      <div className="flex items-center gap-3 rounded-xl border border-brand-border bg-white px-4 py-3">
        <Search className="h-4 w-4 text-brand-muted" />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search clients" className="w-full bg-transparent text-sm outline-none" />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-brand-border p-10 text-center">
          <UserRound className="mx-auto h-7 w-7 text-brand-muted" />
          <p className="mt-4 text-sm font-semibold text-brand-ink">{clients.length ? "No matching clients" : "No clients yet"}</p>
          <p className="mt-2 text-sm text-brand-muted">Add a client before starting a salon consultation.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((client) => (
            <article key={client.id} className="rounded-2xl border border-brand-border bg-white p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-brand-ink">{client.name}</h3>
                  <p className="mt-1 text-xs text-brand-muted">{client.email || client.phone || "No contact details"}</p>
                </div>
                <span className="rounded-full bg-brand-canvas px-3 py-1 text-xs font-semibold text-brand-muted">{client._count.generations} preview{client._count.generations === 1 ? "" : "s"}</span>
              </div>
              <div className="mt-5 flex gap-3">
                <a href={`/upload?source=salon&clientId=${encodeURIComponent(client.id)}`} className="inline-flex items-center gap-2 rounded-full bg-brand-ink px-4 py-2.5 text-xs font-semibold text-white"><UserRound className="h-3.5 w-3.5" /> New preview</a>
                <a href={`/salon/dashboard/history?clientId=${encodeURIComponent(client.id)}`} className="inline-flex items-center gap-2 rounded-full border border-brand-border px-4 py-2.5 text-xs font-semibold text-brand-ink">History <ArrowRight className="h-3.5 w-3.5" /></a>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function Field({ name, label, type = "text", required = false }: { name: string; label: string; type?: string; required?: boolean }) {
  return <label><span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-brand-muted">{label}</span><input name={name} type={type} required={required} className="w-full rounded-xl border border-brand-border bg-white px-4 py-3 text-sm outline-none" /></label>;
}
