"use client";

import { useEffect, useMemo, useState } from "react";

type Style = {
  id: string; name: string; slug: string; promptKey: string; gender: string;
  serviceType: string; category: string | null; description: string | null;
  thumbnailUrl: string | null; displayOrder: number; isActive: boolean;
};
type Prompt = { id: string; hairstyleId: string; version: string; prompt: string; notes: string | null; qaStatus: string; isActive: boolean; hairstyle: { name: string; promptKey: string } };
type Gallery = { id: string; hairstyleId: string; title: string; category: string | null; beforeUrl: string; afterUrl: string; caption: string | null; displayOrder: number; featured: boolean; isPublished: boolean; hairstyle: { name: string } };

const inputClass = "w-full rounded-lg border border-brand-border bg-white px-3 py-2 text-sm text-brand-ink";

export default function AdminContentPage() {
  const [tab, setTab] = useState<"styles" | "prompts" | "gallery">("styles");
  const [styles, setStyles] = useState<Style[]>([]);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [gallery, setGallery] = useState<Gallery[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const load = async () => {
    setLoading(true);
    const response = await fetch("/api/dashboard/admin/content", { cache: "no-store" });
    if (response.ok) {
      const data = await response.json();
      setStyles(data.styles ?? []); setPrompts(data.prompts ?? []); setGallery(data.gallery ?? []);
    }
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const styleOptions = useMemo(() => styles.filter((style) => style.isActive), [styles]);

  const save = async (type: string, payload: Record<string, unknown>, method = "POST") => {
    setMessage("");
    const response = await fetch("/api/dashboard/admin/content", {
      method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type, ...payload }),
    });
    const data = await response.json();
    if (!response.ok) { setMessage(data.error ?? "Save failed"); return false; }
    setMessage("Saved."); await load(); return true;
  };

  const remove = async (type: string, id: string) => {
    if (!window.confirm("Remove this item?")) return;
    const response = await fetch("/api/dashboard/admin/content", {
      method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type, id }),
    });
    if (response.ok) { setMessage("Removed."); await load(); }
  };

  if (loading) return <div className="p-8 text-brand-muted">Loading content manager…</div>;

  return (
    <section className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold text-brand-ink">Content Management</h1>
        <p className="mt-2 text-brand-muted">Manage styles, versioned generation prompts and published gallery transformations without editing code.</p>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-brand-border pb-3">
        {[['styles','Styles'],['prompts','Prompts'],['gallery','Gallery']].map(([key,label]) => (
          <button key={key} onClick={() => setTab(key as typeof tab)} className={`rounded-lg px-4 py-2 text-sm font-medium ${tab === key ? 'bg-brand-ink text-white' : 'bg-brand-surface text-brand-muted'}`}>{label}</button>
        ))}
      </div>

      {message && <div className="rounded-lg border border-brand-border bg-brand-surface px-4 py-3 text-sm text-brand-ink">{message}</div>}

      {tab === "styles" && <StylesTab styles={styles} onSave={save} onRemove={remove} />}
      {tab === "prompts" && <PromptsTab styles={styleOptions} prompts={prompts} onSave={save} onRemove={remove} />}
      {tab === "gallery" && <GalleryTab styles={styleOptions} gallery={gallery} onSave={save} onRemove={remove} />}
    </section>
  );
}

function StylesTab({ styles, onSave, onRemove }: { styles: Style[]; onSave: AdminContentPageProps['save']; onRemove: AdminContentPageProps['remove'] }) {
  const [form, setForm] = useState({ name: "", slug: "", promptKey: "", gender: "FEMALE", category: "BOB", serviceType: "HAIRSTYLE", description: "", displayOrder: 0 });
  return <div className="space-y-6">
    <div className="rounded-xl border border-brand-border bg-brand-surface p-5">
      <h2 className="text-xl font-semibold">Add Style</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {(['name','slug','promptKey','description'] as const).map((key) => <input key={key} className={inputClass} placeholder={key} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />)}
        <select className={inputClass} value={form.serviceType} onChange={(e) => setForm({ ...form, serviceType: e.target.value })}>{['HAIRSTYLE','HAIR_COLOR','BUZZ_CUT','BALD','BEARD','BEARD_REMOVAL'].map(v => <option key={v}>{v}</option>)}</select>
        <select className={inputClass} value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>{['FEMALE','MALE','UNISEX'].map(v => <option key={v}>{v}</option>)}</select>
        <select className={inputClass} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}><option value="">No category</option>{['BOB','LOB','PIXIE','BIXIE','LAYERS','SHAG','WOLF','MULLET','FADE','TAPER','UNDERCUT','CROP','CREW','BRAIDS','LOCS','AFRO','CURLY','BANGS','UPDO'].map(v => <option key={v}>{v}</option>)}</select>
        <input className={inputClass} type="number" placeholder="display order" value={form.displayOrder} onChange={(e) => setForm({ ...form, displayOrder: Number(e.target.value) })} />
      </div>
      <button className="mt-4 rounded-lg bg-brand-ink px-4 py-2 text-sm font-medium text-white" onClick={() => onSave('style', form)}>Add style</button>
    </div>
    <div className="overflow-x-auto rounded-xl border border-brand-border bg-brand-surface"><table className="w-full min-w-[900px] text-sm"><thead><tr className="border-b border-brand-border text-left"><th className="p-3">Style</th><th className="p-3">Category</th><th className="p-3">Prompt key</th><th className="p-3">Order</th><th className="p-3">Status</th><th className="p-3">Action</th></tr></thead><tbody>{styles.map(style => <tr key={style.id} className="border-b border-brand-border"><td className="p-3 font-medium">{style.name}</td><td className="p-3">{style.category ?? '—'}</td><td className="p-3 font-mono text-xs">{style.promptKey}</td><td className="p-3">{style.displayOrder}</td><td className="p-3">{style.isActive ? 'Active' : 'Archived'}</td><td className="p-3"><button className="text-red-600" onClick={() => onRemove('style', style.id)}>Archive</button></td></tr>)}</tbody></table></div>
  </div>;
}

function PromptsTab({ styles, prompts, onSave, onRemove }: { styles: Style[]; prompts: Prompt[]; onSave: AdminContentPageProps['save']; onRemove: AdminContentPageProps['remove'] }) {
  const [form, setForm] = useState({ hairstyleId: styles[0]?.id ?? '', version: 'v1', prompt: '', notes: '', qaStatus: 'DRAFT', isActive: false });
  return <div className="space-y-6">
    <div className="rounded-xl border border-brand-border bg-brand-surface p-5"><h2 className="text-xl font-semibold">Add Prompt Version</h2><p className="mt-1 text-sm text-brand-muted">Only QA Passed or Published prompts marked Active are used by the generation engine. Existing code prompts remain the fallback.</p>
      <div className="mt-4 space-y-3"><select className={inputClass} value={form.hairstyleId} onChange={e => setForm({ ...form, hairstyleId: e.target.value })}>{styles.map(s => <option key={s.id} value={s.id}>{s.name} — {s.promptKey}</option>)}</select><input className={inputClass} placeholder="version, e.g. v2" value={form.version} onChange={e => setForm({ ...form, version: e.target.value })}/><textarea className={`${inputClass} min-h-48`} placeholder="Style prompt" value={form.prompt} onChange={e => setForm({ ...form, prompt: e.target.value })}/><input className={inputClass} placeholder="QA notes" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}/><select className={inputClass} value={form.qaStatus} onChange={e => setForm({ ...form, qaStatus: e.target.value })}>{['DRAFT','TESTING','QA_PASSED','PUBLISHED','ARCHIVED'].map(v => <option key={v}>{v}</option>)}</select><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })}/> Make active</label></div><button className="mt-4 rounded-lg bg-brand-ink px-4 py-2 text-sm font-medium text-white" onClick={() => onSave('prompt', form)}>Create prompt version</button>
    </div>
    <div className="space-y-4">{prompts.map(prompt => <div key={prompt.id} className="rounded-xl border border-brand-border bg-brand-surface p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold">{prompt.hairstyle.name} — {prompt.version}</h3><p className="text-xs text-brand-muted">{prompt.qaStatus} · {prompt.isActive ? 'ACTIVE' : 'inactive'}</p></div><button className="text-red-600 text-sm" onClick={() => onRemove('prompt', prompt.id)}>Delete version</button></div><pre className="mt-4 max-h-56 overflow-auto whitespace-pre-wrap rounded-lg bg-brand-canvas p-4 text-xs">{prompt.prompt}</pre><div className="mt-3 flex gap-2"><button className="rounded-lg border border-brand-border px-3 py-2 text-xs" onClick={() => onSave('prompt', { id: prompt.id, qaStatus: 'TESTING', isActive: false }, 'PATCH')}>Testing</button><button className="rounded-lg border border-brand-border px-3 py-2 text-xs" onClick={() => onSave('prompt', { id: prompt.id, qaStatus: 'QA_PASSED', isActive: true }, 'PATCH')}>Activate QA Passed</button></div></div>)}</div>
  </div>;
}

function GalleryTab({ styles, gallery, onSave, onRemove }: { styles: Style[]; gallery: Gallery[]; onSave: AdminContentPageProps['save']; onRemove: AdminContentPageProps['remove'] }) {
  const [form, setForm] = useState({ hairstyleId: styles[0]?.id ?? '', title: '', category: '', beforeUrl: '', afterUrl: '', caption: '', displayOrder: 0, featured: false, isPublished: false });
  const [uploading, setUploading] = useState<string | null>(null);
  const upload = async (field: 'beforeUrl' | 'afterUrl', file: File | undefined) => {
    if (!file) return;
    setUploading(field);
    const data = new FormData(); data.append('file', file);
    const response = await fetch('/api/dashboard/admin/content/upload', { method: 'POST', body: data });
    const result = await response.json();
    setUploading(null);
    if (response.ok) setForm(prev => ({ ...prev, [field]: result.url }));
  };
  return <div className="space-y-6">
    <div className="rounded-xl border border-brand-border bg-brand-surface p-5"><h2 className="text-xl font-semibold">Add Gallery Transformation</h2><div className="mt-4 grid gap-3 md:grid-cols-2"><select className={inputClass} value={form.hairstyleId} onChange={e => setForm({ ...form, hairstyleId: e.target.value })}>{styles.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select><input className={inputClass} placeholder="title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}/><input className={inputClass} placeholder="category" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}/><input className={inputClass} type="number" placeholder="display order" value={form.displayOrder} onChange={e => setForm({ ...form, displayOrder: Number(e.target.value) })}/><label className="rounded-lg border border-brand-border p-3 text-sm">Before image<input className="mt-2 block w-full text-xs" type="file" accept="image/*" onChange={e => void upload('beforeUrl', e.target.files?.[0])}/>{uploading === 'beforeUrl' ? 'Uploading…' : form.beforeUrl ? 'Uploaded' : ''}</label><label className="rounded-lg border border-brand-border p-3 text-sm">After image<input className="mt-2 block w-full text-xs" type="file" accept="image/*" onChange={e => void upload('afterUrl', e.target.files?.[0])}/>{uploading === 'afterUrl' ? 'Uploading…' : form.afterUrl ? 'Uploaded' : ''}</label><input className={inputClass} placeholder="caption" value={form.caption} onChange={e => setForm({ ...form, caption: e.target.value })}/><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.featured} onChange={e => setForm({ ...form, featured: e.target.checked })}/> Featured</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isPublished} onChange={e => setForm({ ...form, isPublished: e.target.checked })}/> Publish immediately</label></div><button className="mt-4 rounded-lg bg-brand-ink px-4 py-2 text-sm font-medium text-white" disabled={!form.beforeUrl || !form.afterUrl} onClick={() => onSave('gallery', form)}>Add gallery item</button></div>
    <div className="grid gap-4 md:grid-cols-2">{gallery.map(item => <div key={item.id} className="rounded-xl border border-brand-border bg-brand-surface p-4"><div className="grid grid-cols-2 gap-2"><img src={item.beforeUrl} alt={`${item.title} before`} className="aspect-[4/5] w-full rounded-lg object-cover"/><img src={item.afterUrl} alt={`${item.title} after`} className="aspect-[4/5] w-full rounded-lg object-cover"/></div><div className="mt-3 flex items-center justify-between gap-2"><div><h3 className="font-semibold">{item.title}</h3><p className="text-xs text-brand-muted">{item.hairstyle.name} · {item.isPublished ? 'Published' : 'Draft'}</p></div><button className="text-red-600 text-sm" onClick={() => onRemove('gallery', item.id)}>Delete</button></div><button className="mt-3 rounded-lg border border-brand-border px-3 py-2 text-xs" onClick={() => onSave('gallery', { id: item.id, isPublished: !item.isPublished }, 'PATCH')}>{item.isPublished ? 'Unpublish' : 'Publish'}</button></div>)}</div>
  </div>;
}

type AdminContentPageProps = {
  save: (type: string, payload: Record<string, unknown>, method?: string) => Promise<boolean>;
  remove: (type: string, id: string) => Promise<void>;
};
