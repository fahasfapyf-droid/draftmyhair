"use client";

import { useEffect, useMemo, useState } from "react";

type Style = {
  id: string; name: string; slug: string; promptKey: string; description: string | null;
  thumbnailUrl: string | null; serviceType: string; category: string | null; gender: string;
  displayOrder: number; isActive: boolean;
  promptVersions: { id: string; version: number; qaStatus: string; updatedAt: string }[];
  _count: { galleryItems: number; generations: number };
};

type Prompt = {
  id: string; hairstyleId: string; version: number; prompt: string; status: string; qaStatus: string; notes: string | null;
  hairstyle: { id: string; name: string; promptKey: string };
};

type GalleryItem = {
  id: string; title: string; category: string; beforeUrl: string; afterUrl: string;
  featured: boolean; isPublished: boolean; displayOrder: number; hairstyle: { id: string; name: string } | null;
};

const SERVICE_TYPES = ["HAIRSTYLE", "HAIR_COLOR", "BUZZ_CUT", "BALD", "BEARD", "BEARD_REMOVAL"];
const GENDERS = ["FEMALE", "MALE", "UNISEX"];
const CATEGORIES = ["BOB", "LOB", "PIXIE", "BIXIE", "LAYERS", "SHAG", "WOLF", "MULLET", "FADE", "TAPER", "UNDERCUT", "CROP", "CREW", "QUIFF", "POMPADOUR", "SIDE_PART", "COMB_OVER", "MOHAWK", "MAN_BUN", "BRAIDS", "LOCS", "AFRO", "CURLY", "BANGS", "UPDO"];

async function json<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...options, headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "Request failed.");
  return data as T;
}

export function AdminContentLibrary() {
  const [tab, setTab] = useState<"styles" | "prompts" | "gallery">("styles");
  const [styles, setStyles] = useState<Style[]>([]);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [newPrompt, setNewPrompt] = useState({ hairstyleId: "", prompt: "", notes: "", qaStatus: "DRAFT", status: "DRAFT" });
  const [newGallery, setNewGallery] = useState({ title: "", category: "bob", hairstyleId: "", beforeUrl: "", afterUrl: "", featured: false, isPublished: false, displayOrder: 0 });
  const [uploading, setUploading] = useState<"before" | "after" | null>(null);

  const loadAll = async () => {
    setLoading(true); setError("");
    try {
      const [styleData, promptData, galleryData] = await Promise.all([
        json<{ styles: Style[] }>("/api/dashboard/admin/content/styles"),
        json<{ prompts: Prompt[] }>("/api/dashboard/admin/content/prompts"),
        json<{ items: GalleryItem[] }>("/api/dashboard/admin/content/gallery"),
      ]);
      setStyles(styleData.styles); setPrompts(promptData.prompts); setGallery(galleryData.items);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to load content library."); }
    finally { setLoading(false); }
  };

  useEffect(() => { void loadAll(); }, []);

  const activePromptByStyle = useMemo(() => new Map(styles.map((s) => [s.id, s.promptVersions[0]])), [styles]);

  const updateStyle = async (style: Style, patch: Partial<Style>) => {
    try {
      const data = await json<{ style: Style }>(`/api/dashboard/admin/content/styles/${style.id}`, { method: "PATCH", body: JSON.stringify(patch) });
      setStyles((current) => current.map((item) => item.id === style.id ? { ...item, ...data.style } : item));
      setNotice(`${style.name} updated.`);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to update style."); }
  };

  const createPrompt = async () => {
    try {
      await json(`/api/dashboard/admin/content/prompts`, { method: "POST", body: JSON.stringify(newPrompt) });
      setNewPrompt({ hairstyleId: "", prompt: "", notes: "", qaStatus: "DRAFT", status: "DRAFT" });
      await loadAll(); setNotice("New prompt version created.");
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to create prompt."); }
  };

  const updatePrompt = async (prompt: Prompt, patch: Partial<Prompt>) => {
    try {
      await json(`/api/dashboard/admin/content/prompts/${prompt.id}`, { method: "PATCH", body: JSON.stringify(patch) });
      await loadAll(); setNotice(`Prompt v${prompt.version} updated.`);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to update prompt."); }
  };

  const upload = async (kind: "before" | "after", file: File) => {
    setUploading(kind); setError("");
    try {
      const form = new FormData(); form.append("file", file);
      const response = await fetch("/api/dashboard/admin/content/upload", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Upload failed.");
      setNewGallery((current) => ({ ...current, [kind === "before" ? "beforeUrl" : "afterUrl"]: data.url }));
      setNotice(`${kind === "before" ? "Before" : "After"} image uploaded.`);
    } catch (e) { setError(e instanceof Error ? e.message : "Upload failed."); }
    finally { setUploading(null); }
  };

  const createGalleryItem = async () => {
    try {
      await json(`/api/dashboard/admin/content/gallery`, { method: "POST", body: JSON.stringify(newGallery) });
      setNewGallery({ title: "", category: "bob", hairstyleId: "", beforeUrl: "", afterUrl: "", featured: false, isPublished: false, displayOrder: 0 });
      await loadAll(); setNotice("Gallery item created.");
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to create gallery item."); }
  };

  const updateGallery = async (item: GalleryItem, patch: Partial<GalleryItem>) => {
    try {
      await json(`/api/dashboard/admin/content/gallery/${item.id}`, { method: "PATCH", body: JSON.stringify(patch) });
      await loadAll(); setNotice(`${item.title} updated.`);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to update gallery item."); }
  };

  const deleteGallery = async (item: GalleryItem) => {
    if (!window.confirm(`Delete ${item.title}?`)) return;
    try { await json(`/api/dashboard/admin/content/gallery/${item.id}`, { method: "DELETE" }); await loadAll(); setNotice(`${item.title} deleted.`); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to delete gallery item."); }
  };

  if (loading) return <div className="rounded-editorial border border-brand-border bg-brand-surface p-8">Loading content library…</div>;

  return (
    <div className="space-y-6">
      <div className="rounded-editorial border border-brand-border bg-brand-surface p-6 shadow-sm">
        <h2 className="text-2xl font-semibold text-brand-ink">Content Library</h2>
        <p className="mt-2 text-sm text-brand-muted">Manage the hairstyle catalog, production prompt versions and public transformation gallery without editing source files.</p>
      </div>

      {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div> : null}
      {notice ? <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">{notice}</div> : null}

      <div className="flex flex-wrap gap-2">
        {([['styles','Styles'],['prompts','Prompts'],['gallery','Gallery']] as const).map(([key,label]) => (
          <button key={key} onClick={() => setTab(key)} className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab === key ? "bg-brand-ink text-white" : "border border-brand-border bg-brand-surface text-brand-ink"}`}>{label}</button>
        ))}
      </div>

      {tab === "styles" ? (
        <div className="space-y-4">
          {styles.map((style) => {
            const active = activePromptByStyle.get(style.id);
            return <div key={style.id} className="rounded-editorial border border-brand-border bg-brand-surface p-5 shadow-sm">
              <div className="grid gap-4 lg:grid-cols-6">
                <div className="lg:col-span-2"><label className="text-xs font-semibold text-brand-muted">Style name</label><input defaultValue={style.name} onBlur={(e) => e.target.value !== style.name && void updateStyle(style,{name:e.target.value})} className="mt-1 w-full rounded-lg border border-brand-border px-3 py-2" /></div>
                <div><label className="text-xs font-semibold text-brand-muted">Slug</label><input defaultValue={style.slug} onBlur={(e) => e.target.value !== style.slug && void updateStyle(style,{slug:e.target.value})} className="mt-1 w-full rounded-lg border border-brand-border px-3 py-2" /></div>
                <div><label className="text-xs font-semibold text-brand-muted">Category</label><select defaultValue={style.category ?? ""} onChange={(e) => void updateStyle(style,{category:e.target.value || null})} className="mt-1 w-full rounded-lg border border-brand-border px-3 py-2"><option value="">None</option>{CATEGORIES.map((c)=><option key={c}>{c}</option>)}</select></div>
                <div><label className="text-xs font-semibold text-brand-muted">Service</label><select defaultValue={style.serviceType} onChange={(e) => void updateStyle(style,{serviceType:e.target.value})} className="mt-1 w-full rounded-lg border border-brand-border px-3 py-2">{SERVICE_TYPES.map((s)=><option key={s}>{s}</option>)}</select></div>
                <div><label className="text-xs font-semibold text-brand-muted">Gender</label><select defaultValue={style.gender} onChange={(e) => void updateStyle(style,{gender:e.target.value})} className="mt-1 w-full rounded-lg border border-brand-border px-3 py-2">{GENDERS.map((g)=><option key={g}>{g}</option>)}</select></div>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <input defaultValue={style.thumbnailUrl ?? ""} placeholder="Thumbnail URL" onBlur={(e) => void updateStyle(style,{thumbnailUrl:e.target.value})} className="rounded-lg border border-brand-border px-3 py-2" />
                <input defaultValue={style.promptKey} placeholder="Prompt key" onBlur={(e) => e.target.value !== style.promptKey && void updateStyle(style,{promptKey:e.target.value})} className="rounded-lg border border-brand-border px-3 py-2" />
                <label className="flex items-center gap-2 rounded-lg border border-brand-border px-3 py-2 text-sm"><input type="checkbox" defaultChecked={style.isActive} onChange={(e) => void updateStyle(style,{isActive:e.target.checked})} /> Active on customer selector</label>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-brand-muted"><span>Prompt: {active ? `v${active.version} · ${active.qaStatus}` : "compiled fallback"}</span><span>Gallery: {style._count.galleryItems}</span><span>Generations: {style._count.generations}</span></div>
            </div>;
          })}
        </div>
      ) : null}

      {tab === "prompts" ? (
        <div className="space-y-5">
          <div className="rounded-editorial border border-brand-border bg-brand-surface p-5 shadow-sm">
            <h3 className="font-semibold text-brand-ink">Create new prompt version</h3>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <select value={newPrompt.hairstyleId} onChange={(e)=>setNewPrompt({...newPrompt,hairstyleId:e.target.value})} className="rounded-lg border border-brand-border px-3 py-2"><option value="">Select hairstyle</option>{styles.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select>
              <select value={newPrompt.qaStatus} onChange={(e)=>setNewPrompt({...newPrompt,qaStatus:e.target.value})} className="rounded-lg border border-brand-border px-3 py-2"><option>DRAFT</option><option>TESTING</option><option>PASSED</option></select>
            </div>
            <textarea value={newPrompt.prompt} onChange={(e)=>setNewPrompt({...newPrompt,prompt:e.target.value})} placeholder="Full hairstyle prompt" className="mt-3 min-h-48 w-full rounded-lg border border-brand-border p-3 font-mono text-sm" />
            <textarea value={newPrompt.notes} onChange={(e)=>setNewPrompt({...newPrompt,notes:e.target.value})} placeholder="QA notes / known failure points" className="mt-3 min-h-24 w-full rounded-lg border border-brand-border p-3 text-sm" />
            <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={newPrompt.status === "ACTIVE"} onChange={(e)=>setNewPrompt({...newPrompt,status:e.target.checked?"ACTIVE":"DRAFT"})}/> Make this the active production prompt</label>
            <button onClick={() => void createPrompt()} className="mt-4 rounded-lg bg-brand-ink px-4 py-2 text-sm font-semibold text-white">Create version</button>
          </div>
          {prompts.map((prompt) => <div key={prompt.id} className="rounded-editorial border border-brand-border bg-brand-surface p-5 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold text-brand-ink">{prompt.hairstyle.name} · v{prompt.version}</h3><p className="text-xs text-brand-muted">{prompt.status} · QA {prompt.qaStatus}</p></div><div className="flex gap-2"><button onClick={()=>void updatePrompt(prompt,{status:prompt.status==="ACTIVE"?"ARCHIVED":"ACTIVE"})} className="rounded-lg border border-brand-border px-3 py-2 text-xs font-semibold">{prompt.status==="ACTIVE"?"Archive":"Make Active"}</button><select value={prompt.qaStatus} onChange={(e)=>void updatePrompt(prompt,{qaStatus:e.target.value})} className="rounded-lg border border-brand-border px-2 py-2 text-xs"><option>DRAFT</option><option>TESTING</option><option>PASSED</option></select></div></div><textarea defaultValue={prompt.prompt} onBlur={(e)=>e.target.value!==prompt.prompt && void updatePrompt(prompt,{prompt:e.target.value})} className="mt-4 min-h-40 w-full rounded-lg border border-brand-border p-3 font-mono text-xs" /><textarea defaultValue={prompt.notes ?? ""} onBlur={(e)=>void updatePrompt(prompt,{notes:e.target.value})} placeholder="Notes" className="mt-3 min-h-20 w-full rounded-lg border border-brand-border p-3 text-sm" /></div>)}
        </div>
      ) : null}

      {tab === "gallery" ? (
        <div className="space-y-5">
          <div className="rounded-editorial border border-brand-border bg-brand-surface p-5 shadow-sm">
            <h3 className="font-semibold text-brand-ink">Add transformation</h3>
            <div className="mt-4 grid gap-3 md:grid-cols-2"><input value={newGallery.title} onChange={(e)=>setNewGallery({...newGallery,title:e.target.value})} placeholder="Title" className="rounded-lg border border-brand-border px-3 py-2" /><input value={newGallery.category} onChange={(e)=>setNewGallery({...newGallery,category:e.target.value})} placeholder="Category" className="rounded-lg border border-brand-border px-3 py-2" /><select value={newGallery.hairstyleId} onChange={(e)=>setNewGallery({...newGallery,hairstyleId:e.target.value})} className="rounded-lg border border-brand-border px-3 py-2"><option value="">No linked hairstyle</option>{styles.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select><input type="number" value={newGallery.displayOrder} onChange={(e)=>setNewGallery({...newGallery,displayOrder:Number(e.target.value)})} placeholder="Display order" className="rounded-lg border border-brand-border px-3 py-2" /></div>
            <div className="mt-4 grid gap-4 md:grid-cols-2"><div><label className="text-xs font-semibold text-brand-muted">Before</label><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e)=>e.target.files?.[0] && void upload("before",e.target.files[0])} className="mt-1 block w-full text-sm" /><input value={newGallery.beforeUrl} onChange={(e)=>setNewGallery({...newGallery,beforeUrl:e.target.value})} placeholder="Or paste before image URL" className="mt-2 w-full rounded-lg border border-brand-border px-3 py-2 text-sm" />{uploading==="before"?<p className="text-xs text-brand-muted">Uploading…</p>:null}</div><div><label className="text-xs font-semibold text-brand-muted">After</label><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e)=>e.target.files?.[0] && void upload("after",e.target.files[0])} className="mt-1 block w-full text-sm" /><input value={newGallery.afterUrl} onChange={(e)=>setNewGallery({...newGallery,afterUrl:e.target.value})} placeholder="Or paste after image URL" className="mt-2 w-full rounded-lg border border-brand-border px-3 py-2 text-sm" />{uploading==="after"?<p className="text-xs text-brand-muted">Uploading…</p>:null}</div></div>
            <div className="mt-3 flex gap-5 text-sm"><label><input type="checkbox" checked={newGallery.featured} onChange={(e)=>setNewGallery({...newGallery,featured:e.target.checked})} /> Featured</label><label><input type="checkbox" checked={newGallery.isPublished} onChange={(e)=>setNewGallery({...newGallery,isPublished:e.target.checked})} /> Published</label></div>
            <button onClick={()=>void createGalleryItem()} className="mt-4 rounded-lg bg-brand-ink px-4 py-2 text-sm font-semibold text-white">Add to gallery</button>
          </div>
          {gallery.map(item=><div key={item.id} className="rounded-editorial border border-brand-border bg-brand-surface p-4 shadow-sm"><div className="grid gap-4 md:grid-cols-[180px_1fr_1fr] md:items-center"><img src={item.beforeUrl} alt="" className="aspect-[4/5] w-full rounded-lg object-cover" /><img src={item.afterUrl} alt={item.title} className="aspect-[4/5] w-full rounded-lg object-cover" /><div><h3 className="font-semibold text-brand-ink">{item.title}</h3><p className="mt-1 text-xs text-brand-muted">{item.category}{item.hairstyle ? ` · ${item.hairstyle.name}` : ""}</p><div className="mt-4 flex flex-wrap gap-2"><button onClick={()=>void updateGallery(item,{isPublished:!item.isPublished})} className="rounded-lg border border-brand-border px-3 py-2 text-xs font-semibold">{item.isPublished?"Unpublish":"Publish"}</button><button onClick={()=>void updateGallery(item,{featured:!item.featured})} className="rounded-lg border border-brand-border px-3 py-2 text-xs font-semibold">{item.featured?"Unfeature":"Feature"}</button><button onClick={()=>void deleteGallery(item)} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700">Delete</button></div></div></div></div>)}
        </div>
      ) : null}
    </div>
  );
}
