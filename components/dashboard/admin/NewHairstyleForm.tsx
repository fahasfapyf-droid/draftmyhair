"use client";

import Link from "next/link";
import { useState } from "react";

const serviceTypes = ["HAIRSTYLE", "HAIR_COLOR", "BUZZ_CUT", "BALD", "BEARD", "BEARD_REMOVAL"];
const genders = ["FEMALE", "MALE", "UNISEX"];
const categories = ["BOB", "LOB", "PIXIE", "BIXIE", "LAYERS", "SHAG", "WOLF", "MULLET", "FADE", "TAPER", "UNDERCUT", "CROP", "CREW", "QUIFF", "POMPADOUR", "SIDE_PART", "COMB_OVER", "MOHAWK", "MAN_BUN", "BRAIDS", "LOCS", "AFRO", "CURLY", "BANGS", "UPDO"];

export function NewHairstyleForm() {
  const [form, setForm] = useState({ name: "", slug: "", promptKey: "", description: "", thumbnailUrl: "", serviceType: "HAIRSTYLE", category: "", gender: "UNISEX", displayOrder: 0 });
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setSaving(true); setMessage("");
    try {
      const response = await fetch("/api/dashboard/admin/content/styles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to create hairstyle.");
      setMessage("Hairstyle created successfully. Add its production prompt from the Prompts tab.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to create hairstyle."); }
    finally { setSaving(false); }
  };

  return <form onSubmit={submit} className="space-y-5 rounded-editorial border border-brand-border bg-brand-surface p-6 shadow-sm">
    {message ? <div className="rounded-lg border border-brand-border bg-brand-background p-4 text-sm">{message}</div> : null}
    <div className="grid gap-4 md:grid-cols-2">
      <input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Style name" className="rounded-lg border border-brand-border px-3 py-2" />
      <input required value={form.slug} onChange={e=>setForm({...form,slug:e.target.value})} placeholder="Slug" className="rounded-lg border border-brand-border px-3 py-2" />
      <input required value={form.promptKey} onChange={e=>setForm({...form,promptKey:e.target.value})} placeholder="Production prompt key" className="rounded-lg border border-brand-border px-3 py-2" />
      <input value={form.thumbnailUrl} onChange={e=>setForm({...form,thumbnailUrl:e.target.value})} placeholder="Thumbnail URL" className="rounded-lg border border-brand-border px-3 py-2" />
      <select value={form.serviceType} onChange={e=>setForm({...form,serviceType:e.target.value})} className="rounded-lg border border-brand-border px-3 py-2">{serviceTypes.map(x=><option key={x}>{x}</option>)}</select>
      <select value={form.category} onChange={e=>setForm({...form,category:e.target.value})} className="rounded-lg border border-brand-border px-3 py-2"><option value="">No category</option>{categories.map(x=><option key={x}>{x}</option>)}</select>
      <select value={form.gender} onChange={e=>setForm({...form,gender:e.target.value})} className="rounded-lg border border-brand-border px-3 py-2">{genders.map(x=><option key={x}>{x}</option>)}</select>
      <input type="number" min="0" value={form.displayOrder} onChange={e=>setForm({...form,displayOrder:Number(e.target.value)})} placeholder="Display order" className="rounded-lg border border-brand-border px-3 py-2" />
    </div>
    <textarea value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Customer-facing description" className="min-h-28 w-full rounded-lg border border-brand-border p-3" />
    <div className="flex gap-3"><button disabled={saving} className="rounded-lg bg-brand-ink px-4 py-2 text-sm font-semibold text-white">{saving ? "Creating…" : "Create hairstyle"}</button><Link href="/dashboard/admin/content" className="rounded-lg border border-brand-border px-4 py-2 text-sm font-semibold">Back to Content Library</Link></div>
  </form>;
}
