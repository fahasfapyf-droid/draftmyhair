"use client";

import { useEffect, useMemo, useState } from "react";

type ContentItem = {
  id: string; name: string; slug: string; promptKey: string; description: string | null;
  thumbnailUrl: string | null; serviceType: string; category: string | null; gender: string;
  displayOrder: number; isActive: boolean;
  promptVersions: { id: string; version: number; qaStatus: string; updatedAt: string }[];
  _count: { galleryItems: number; generations: number };
};

type Prompt = { id: string; hairstyleId: string; version: number; prompt: string; status: string; qaStatus: string; notes: string | null; hairstyle: { id: string; name: string; promptKey: string } };
type GalleryItem = { id: string; title: string; category: string; beforeUrl: string; afterUrl: string; featured: boolean; isPublished: boolean; displayOrder: number; hairstyleId?: string | null; hairstyle: { id: string; name: string } | null };

const SERVICE_TYPES = [["ALL", "All content"], ["HAIRSTYLE", "Hairstyle"], ["HAIR_COLOR", "Hair Colour"], ["BUZZ_CUT", "Buzz Cut"], ["BALD", "Bald"], ["BEARD", "Beard"], ["BEARD_REMOVAL", "Clean Shave / Beard Removal"]] as const;
const GENDERS = ["FEMALE", "MALE", "UNISEX"] as const;
const CATEGORIES = ["BOB", "LOB", "PIXIE", "BIXIE", "LAYERS", "SHAG", "WOLF", "MULLET", "FADE", "TAPER", "UNDERCUT", "CROP", "CREW", "QUIFF", "POMPADOUR", "SIDE_PART", "COMB_OVER", "MOHAWK", "MAN_BUN", "BRAIDS", "LOCS", "AFRO", "CURLY", "BANGS", "UPDO"];
const labelForService = (value: string) => SERVICE_TYPES.find(([key]) => key === value)?.[1] ?? value;

async function json<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...options, headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "Request failed.");
  return data as T;
}

const emptyContent = { name: "", slug: "", promptKey: "", description: "", thumbnailUrl: "", serviceType: "HAIRSTYLE", category: "", gender: "UNISEX", displayOrder: 0 };

export function AdminContentLibrary() {
  const [tab, setTab] = useState<"content" | "prompts" | "gallery">("content");
  const [filter, setFilter] = useState("ALL");
  const [content, setContent] = useState<ContentItem[]>([]);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newContent, setNewContent] = useState(emptyContent);
  const [newPrompt, setNewPrompt] = useState({ hairstyleId: "", prompt: "", notes: "", qaStatus: "DRAFT", status: "DRAFT" });
  const [newGallery, setNewGallery] = useState({ title: "", category: "", hairstyleId: "", beforeUrl: "", afterUrl: "", featured: false, isPublished: false, displayOrder: 0 });
  const [uploading, setUploading] = useState<"before" | "after" | null>(null);

  const loadAll = async () => {
    setLoading(true); setError("");
    try {
      const [contentData, promptData, galleryData] = await Promise.all([
        json<{ styles: ContentItem[] }>("/api/dashboard/admin/content/styles"),
        json<{ prompts: Prompt[] }>("/api/dashboard/admin/content/prompts"),
        json<{ items: GalleryItem[] }>("/api/dashboard/admin/content/gallery"),
      ]);
      setContent(contentData.styles); setPrompts(promptData.prompts); setGallery(galleryData.items);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to load content library."); }
    finally { setLoading(false); }
  };

  useEffect(() => { void loadAll(); }, []);
  const filteredContent = useMemo(() => filter === "ALL" ? content : content.filter((item) => item.serviceType === filter), [content, filter]);
  const activePromptByContent = useMemo(() => new Map(content.map((item) => [item.id, item.promptVersions[0]])), [content]);

  const createContent = async () => {
    setError(""); setNotice("");
    try {
      if (!newContent.name.trim() || !newContent.slug.trim() || !newContent.promptKey.trim()) throw new Error("Name, slug and production prompt key are required.");
      await json("/api/dashboard/admin/content/styles", { method: "POST", body: JSON.stringify(newContent) });
      setNewContent({ ...emptyContent }); setShowCreate(false); await loadAll(); setNotice("Content item created. Add its production prompt from the Prompts tab.");
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to create content item."); }
  };

  const updateContent = async (item: ContentItem, patch: Partial<ContentItem>) => {
    try {
      const data = await json<{ style: ContentItem }>(`/api/dashboard/admin/content/styles/${item.id}`, { method: "PATCH", body: JSON.stringify(patch) });
      setContent((current) => current.map((entry) => entry.id === item.id ? { ...entry, ...data.style } : entry)); setNotice(`${item.name} updated.`);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to update content item."); }
  };

  const createPrompt = async () => {
    try {
      if (!newPrompt.hairstyleId || !newPrompt.prompt.trim()) throw new Error("Select content and enter a production prompt.");
      await json("/api/dashboard/admin/content/prompts", { method: "POST", body: JSON.stringify(newPrompt) });
      setNewPrompt({ hairstyleId: "", prompt: "", notes: "", qaStatus: "DRAFT", status: "DRAFT" }); await loadAll(); setNotice("New prompt version created.");
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to create prompt."); }
  };

  const updatePrompt = async (prompt: Prompt, patch: Partial<Prompt>) => {
    try { await json(`/api/dashboard/admin/content/prompts/${prompt.id}`, { method: "PATCH", body: JSON.stringify(patch) }); await loadAll(); setNotice(`${prompt.hairstyle.name} v${prompt.version} updated.`); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to update prompt."); }
  };

  const upload = async (kind: "before" | "after", file: File) => {
    setUploading(kind); setError("");
    try {
      const form = new FormData(); form.append("file", file); const response = await fetch("/api/dashboard/admin/content/upload", { method: "POST", body: form });
      const data = await response.json(); if (!response.ok) throw new Error(data.error ?? "Upload failed.");
      setNewGallery((current) => ({ ...current, [kind === "before" ? "beforeUrl" : "afterUrl"]: data.url })); setNotice(`${kind === "before" ? "Before" : "After"} image uploaded.`);
    } catch (e) { setError(e instanceof Error ? e.message : "Upload failed."); }
    finally { setUploading(null); }
  };

  const createGalleryItem = async () => {
    try {
      if (!newGallery.title || !newGallery.category || !newGallery.beforeUrl || !newGallery.afterUrl) throw new Error("Title, category, before image and after image are required.");
      await json("/api/dashboard/admin/content/gallery", { method: "POST", body: JSON.stringify(newGallery) });
      setNewGallery({ title: "", category: "", hairstyleId: "", beforeUrl: "", afterUrl: "", featured: false, isPublished: false, displayOrder: 0 }); await loadAll(); setNotice("Gallery item created.");
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to create gallery item."); }
  };

  const updateGallery = async (item: GalleryItem, patch: Partial<GalleryItem>) => {
    try { await json(`/api/dashboard/admin/content/gallery/${item.id}`, { method: "PATCH", body: JSON.stringify(patch) }); await loadAll(); setNotice(`${item.title} updated.`); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to update gallery item."); }
  };
  const deleteGallery = async (item: GalleryItem) => {
    if (!window.confirm(`Delete ${item.title}?`)) return;
    try { await json(`/api/dashboard/admin/content/gallery/${item.id}`, { method: "DELETE" }); await loadAll(); setNotice(`${item.title} deleted.`); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to delete gallery item."); }
  };

  if (loading) return <div className="rounded-editorial border border-brand-border bg-brand-surface p-8">Loading content library…</div>;

  return <div className="space-y-6">
    <div className="rounded-editorial border border-brand-border bg-brand-surface p-6 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-2xl font-semibold text-brand-ink">Content Library</h2><p className="mt-2 text-sm text-brand-muted">Manage hairstyles, hair colours, buzz cuts, bald looks, beards, clean shaves, production prompts and public transformations without editing source files.</p></div>{tab === "content" ? <button onClick={() => setShowCreate((value) => !value)} className="rounded-lg bg-brand-ink px-4 py-2 text-sm font-semibold text-white">{showCreate ? "Close" : "+ Add Content"}</button> : null}</div></div>
    {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div> : null}
    {notice ? <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">{notice}</div> : null}
    <div className="flex flex-wrap gap-2">{([['content','Content'],['prompts','Prompts'],['gallery','Gallery']] as const).map(([key,label]) => <button key={key} onClick={() => setTab(key)} className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab === key ? "bg-brand-ink text-white" : "border border-brand-border bg-brand-surface text-brand-ink"}`}>{label}</button>)}</div>

    {tab === "content" ? <div className="space-y-5">
      {showCreate ? <div className="rounded-editorial border border-brand-border bg-brand-surface p-5 shadow-sm"><h3 className="text-lg font-semibold text-brand-ink">Add new content</h3><p className="mt-1 text-sm text-brand-muted">One content model handles all six customer services.</p><div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <input value={newContent.name} onChange={(e)=>setNewContent({...newContent,name:e.target.value})} placeholder="Name" className="rounded-lg border border-brand-border px-3 py-2" />
        <input value={newContent.slug} onChange={(e)=>setNewContent({...newContent,slug:e.target.value})} placeholder="Slug" className="rounded-lg border border-brand-border px-3 py-2" />
        <input value={newContent.promptKey} onChange={(e)=>setNewContent({...newContent,promptKey:e.target.value})} placeholder="Production prompt key" className="rounded-lg border border-brand-border px-3 py-2" />
        <select value={newContent.serviceType} onChange={(e)=>setNewContent({...newContent,serviceType:e.target.value})} className="rounded-lg border border-brand-border px-3 py-2">{SERVICE_TYPES.filter(([key])=>key!=="ALL").map(([key,label])=><option key={key} value={key}>{label}</option>)}</select>
        <select value={newContent.category} onChange={(e)=>setNewContent({...newContent,category:e.target.value})} className="rounded-lg border border-brand-border px-3 py-2"><option value="">No hairstyle category</option>{CATEGORIES.map((category)=><option key={category}>{category}</option>)}</select>
        <select value={newContent.gender} onChange={(e)=>setNewContent({...newContent,gender:e.target.value})} className="rounded-lg border border-brand-border px-3 py-2">{GENDERS.map((gender)=><option key={gender}>{gender}</option>)}</select>
      </div><input value={newContent.thumbnailUrl} onChange={(e)=>setNewContent({...newContent,thumbnailUrl:e.target.value})} placeholder="Thumbnail URL (optional)" className="mt-4 w-full rounded-lg border border-brand-border px-3 py-2" /><textarea value={newContent.description} onChange={(e)=>setNewContent({...newContent,description:e.target.value})} placeholder="Customer-facing description (optional)" className="mt-4 min-h-24 w-full rounded-lg border border-brand-border p-3" /><button onClick={()=>void createContent()} className="mt-4 rounded-lg bg-brand-ink px-4 py-2 text-sm font-semibold text-white">Create content</button></div> : null}
      <div className="flex flex-wrap gap-2">{SERVICE_TYPES.map(([key,label]) => <button key={key} onClick={()=>setFilter(key)} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${filter===key ? "bg-brand-ink text-white" : "border border-brand-border bg-brand-surface text-brand-ink"}`}>{label}</button>)}</div>
      <div className="text-sm text-brand-muted">{filteredContent.length} content item{filteredContent.length === 1 ? "" : "s"}</div>
      {filteredContent.map((item) => { const active = activePromptByContent.get(item.id); return <div key={item.id} className="rounded-editorial border border-brand-border bg-brand-surface p-5 shadow-sm"><div className="grid gap-4 lg:grid-cols-6">
        <div className="lg:col-span-2"><label className="text-xs font-semibold text-brand-muted">Name</label><input defaultValue={item.name} onBlur={(e)=>e.target.value!==item.name&&void updateContent(item,{name:e.target.value})} className="mt-1 w-full rounded-lg border border-brand-border px-3 py-2" /></div>
        <div><label className="text-xs font-semibold text-brand-muted">Slug</label><input defaultValue={item.slug} onBlur={(e)=>e.target.value!==item.slug&&void updateContent(item,{slug:e.target.value})} className="mt-1 w-full rounded-lg border border-brand-border px-3 py-2" /></div>
        <div><label className="text-xs font-semibold text-brand-muted">Category</label><select defaultValue={item.category ?? ""} onChange={(e)=>void updateContent(item,{category:e.target.value||null})} className="mt-1 w-full rounded-lg border border-brand-border px-3 py-2"><option value="">None</option>{CATEGORIES.map((c)=><option key={c}>{c}</option>)}</select></div>
        <div><label className="text-xs font-semibold text-brand-muted">Service</label><select defaultValue={item.serviceType} onChange={(e)=>void updateContent(item,{serviceType:e.target.value})} className="mt-1 w-full rounded-lg border border-brand-border px-3 py-2">{SERVICE_TYPES.filter(([key])=>key!=="ALL").map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></div>
        <div><label className="text-xs font-semibold text-brand-muted">Gender</label><select defaultValue={item.gender} onChange={(e)=>void updateContent(item,{gender:e.target.value})} className="mt-1 w-full rounded-lg border border-brand-border px-3 py-2">{GENDERS.map((g)=><option key={g}>{g}</option>)}</select></div>
      </div><div className="mt-4 grid gap-4 md:grid-cols-3"><input defaultValue={item.thumbnailUrl ?? ""} placeholder="Thumbnail URL" onBlur={(e)=>void updateContent(item,{thumbnailUrl:e.target.value})} className="rounded-lg border border-brand-border px-3 py-2" /><input defaultValue={item.promptKey} placeholder="Prompt key" onBlur={(e)=>e.target.value!==item.promptKey&&void updateContent(item,{promptKey:e.target.value})} className="rounded-lg border border-brand-border px-3 py-2" /><label className="flex items-center gap-2 rounded-lg border border-brand-border px-3 py-2 text-sm"><input type="checkbox" defaultChecked={item.isActive} onChange={(e)=>void updateContent(item,{isActive:e.target.checked})} /> Active on customer selector</label></div><div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-brand-muted"><span>{labelForService(item.serviceType)}</span><span>Prompt: {active ? `v${active.version} · ${active.qaStatus}` : "compiled fallback"}</span><span>Gallery: {item._count.galleryItems}</span><span>Generations: {item._count.generations}</span></div></div>; })}
    </div> : null}

    {tab === "prompts" ? <div className="space-y-5"><div className="rounded-editorial border border-brand-border bg-brand-surface p-5 shadow-sm"><h3 className="font-semibold text-brand-ink">Create new production prompt version</h3><div className="mt-4 grid gap-3 md:grid-cols-2"><select value={newPrompt.hairstyleId} onChange={(e)=>setNewPrompt({...newPrompt,hairstyleId:e.target.value})} className="rounded-lg border border-brand-border px-3 py-2"><option value="">Select content</option>{content.map((item)=><option key={item.id} value={item.id}>{item.name} — {labelForService(item.serviceType)}</option>)}</select><select value={newPrompt.qaStatus} onChange={(e)=>setNewPrompt({...newPrompt,qaStatus:e.target.value})} className="rounded-lg border border-brand-border px-3 py-2"><option>DRAFT</option><option>TESTING</option><option>PASSED</option></select></div><textarea value={newPrompt.prompt} onChange={(e)=>setNewPrompt({...newPrompt,prompt:e.target.value})} placeholder="Full production prompt" className="mt-3 min-h-48 w-full rounded-lg border border-brand-border p-3 font-mono text-sm" /><textarea value={newPrompt.notes} onChange={(e)=>setNewPrompt({...newPrompt,notes:e.target.value})} placeholder="QA notes / known failure points" className="mt-3 min-h-24 w-full rounded-lg border border-brand-border p-3 text-sm" /><label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={newPrompt.status === "ACTIVE"} onChange={(e)=>setNewPrompt({...newPrompt,status:e.target.checked?"ACTIVE":"DRAFT"})}/> Make this the active production prompt</label><button onClick={()=>void createPrompt()} className="mt-4 rounded-lg bg-brand-ink px-4 py-2 text-sm font-semibold text-white">Create version</button></div>{prompts.map((prompt)=><div key={prompt.id} className="rounded-editorial border border-brand-border bg-brand-surface p-5 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold text-brand-ink">{prompt.hairstyle.name} · v{prompt.version}</h3><p className="text-xs text-brand-muted">{labelForService(content.find((item)=>item.id===prompt.hairstyleId)?.serviceType ?? "")} · {prompt.status} · QA {prompt.qaStatus}</p></div><div className="flex gap-2"><button onClick={()=>void updatePrompt(prompt,{status:prompt.status==="ACTIVE"?"ARCHIVED":"ACTIVE"})} className="rounded-lg border border-brand-border px-3 py-2 text-xs font-semibold">{prompt.status==="ACTIVE"?"Archive":"Make Active"}</button><select value={prompt.qaStatus} onChange={(e)=>void updatePrompt(prompt,{qaStatus:e.target.value})} className="rounded-lg border border-brand-border px-2 py-2 text-xs"><option>DRAFT</option><option>TESTING</option><option>PASSED</option></select></div></div><textarea defaultValue={prompt.prompt} onBlur={(e)=>e.target.value!==prompt.prompt&&void updatePrompt(prompt,{prompt:e.target.value})} className="mt-4 min-h-40 w-full rounded-lg border border-brand-border p-3 font-mono text-xs" /><textarea defaultValue={prompt.notes ?? ""} onBlur={(e)=>void updatePrompt(prompt,{notes:e.target.value})} placeholder="Notes" className="mt-3 min-h-20 w-full rounded-lg border border-brand-border p-3 text-sm" /></div>)}</div> : null}

    {tab === "gallery" ? <div className="space-y-5"><div className="rounded-editorial border border-brand-border bg-brand-surface p-5 shadow-sm"><h3 className="font-semibold text-brand-ink">Add public transformation</h3><p className="mt-1 text-sm text-brand-muted">Attach before/after images to any content item and publish them to the public gallery.</p><div className="mt-4 grid gap-3 md:grid-cols-2"><input value={newGallery.title} onChange={(e)=>setNewGallery({...newGallery,title:e.target.value})} placeholder="Gallery title" className="rounded-lg border border-brand-border px-3 py-2" /><select value={newGallery.hairstyleId} onChange={(e)=>setNewGallery({...newGallery,hairstyleId:e.target.value})} className="rounded-lg border border-brand-border px-3 py-2"><option value="">Select content (optional)</option>{content.map((item)=><option key={item.id} value={item.id}>{item.name} — {labelForService(item.serviceType)}</option>)}</select><input value={newGallery.category} onChange={(e)=>setNewGallery({...newGallery,category:e.target.value})} placeholder="Gallery category / service" className="rounded-lg border border-brand-border px-3 py-2" /><input type="number" min="0" value={newGallery.displayOrder} onChange={(e)=>setNewGallery({...newGallery,displayOrder:Number(e.target.value)})} placeholder="Display order" className="rounded-lg border border-brand-border px-3 py-2" /></div><div className="mt-4 grid gap-4 md:grid-cols-2"><div><label className="text-xs font-semibold text-brand-muted">Before image</label><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e)=>e.target.files?.[0]&&void upload("before",e.target.files[0])} className="mt-1 block w-full rounded-lg border border-brand-border px-3 py-2 text-sm" /><p className="mt-1 text-xs text-brand-muted">{uploading==="before"?"Uploading…":newGallery.beforeUrl||"No image uploaded"}</p></div><div><label className="text-xs font-semibold text-brand-muted">After image</label><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e)=>e.target.files?.[0]&&void upload("after",e.target.files[0])} className="mt-1 block w-full rounded-lg border border-brand-border px-3 py-2 text-sm" /><p className="mt-1 text-xs text-brand-muted">{uploading==="after"?"Uploading…":newGallery.afterUrl||"No image uploaded"}</p></div></div><div className="mt-3 flex flex-wrap gap-5 text-sm"><label className="flex items-center gap-2"><input type="checkbox" checked={newGallery.featured} onChange={(e)=>setNewGallery({...newGallery,featured:e.target.checked})}/> Featured</label><label className="flex items-center gap-2"><input type="checkbox" checked={newGallery.isPublished} onChange={(e)=>setNewGallery({...newGallery,isPublished:e.target.checked})}/> Published</label></div><button onClick={()=>void createGalleryItem()} className="mt-4 rounded-lg bg-brand-ink px-4 py-2 text-sm font-semibold text-white">Add transformation</button></div>{gallery.map((item)=><div key={item.id} className="rounded-editorial border border-brand-border bg-brand-surface p-5 shadow-sm"><div className="grid gap-3 md:grid-cols-4"><input defaultValue={item.title} onBlur={(e)=>e.target.value!==item.title&&void updateGallery(item,{title:e.target.value})} className="rounded-lg border border-brand-border px-3 py-2" /><input defaultValue={item.category} onBlur={(e)=>void updateGallery(item,{category:e.target.value})} className="rounded-lg border border-brand-border px-3 py-2" /><select defaultValue={item.hairstyle?.id ?? ""} onChange={(e)=>void updateGallery(item,{hairstyleId:e.target.value})} className="rounded-lg border border-brand-border px-3 py-2"><option value="">No linked content</option>{content.map((entry)=><option key={entry.id} value={entry.id}>{entry.name}</option>)}</select><input type="number" min="0" defaultValue={item.displayOrder} onBlur={(e)=>void updateGallery(item,{displayOrder:Number(e.target.value)})} className="rounded-lg border border-brand-border px-3 py-2" /></div><div className="mt-3 flex flex-wrap gap-5 text-sm"><label className="flex items-center gap-2"><input type="checkbox" defaultChecked={item.featured} onChange={(e)=>void updateGallery(item,{featured:e.target.checked})}/> Featured</label><label className="flex items-center gap-2"><input type="checkbox" defaultChecked={item.isPublished} onChange={(e)=>void updateGallery(item,{isPublished:e.target.checked})}/> Published</label><button onClick={()=>void deleteGallery(item)} className="rounded-lg border border-red-200 px-3 py-1 text-xs font-semibold text-red-700">Delete</button></div></div>)}</div> : null}
  </div>;
}
