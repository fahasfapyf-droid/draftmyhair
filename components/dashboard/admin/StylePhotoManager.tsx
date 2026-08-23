"use client";

import { PointerEvent, useEffect, useMemo, useState } from "react";

const MAX_UPLOAD_SIZE = 4 * 1024 * 1024;
const DEFAULT_POSITION = { x: 50, y: 50 };

type PhotoPosition = { x: number; y: number };

type StyleItem = {
  id: string;
  name: string;
  thumbnailUrl: string | null;
  serviceType: string;
  category: string | null;
  gender: string;
};

function clampPosition(value: number) { return Math.max(0, Math.min(100, Math.round(value))); }

function getPhotoPosition(url: string | null): PhotoPosition {
  if (!url) return DEFAULT_POSITION;
  const match = url.match(/#pos=(\d+),(\d+)$/);
  if (!match) return DEFAULT_POSITION;
  return { x: clampPosition(Number(match[1])), y: clampPosition(Number(match[2])) };
}

function withPhotoPosition(url: string, position: PhotoPosition) {
  const baseUrl = url.replace(/#pos=\d+,\d+$/, "");
  return `${baseUrl}#pos=${clampPosition(position.x)},${clampPosition(position.y)}`;
}

function formatPosition(url: string | null) {
  const position = getPhotoPosition(url);
  return `${position.x}% horizontal · ${position.y}% vertical`;
}

async function readResponse(response: Response) {
  const text = await response.text();
  if (!text) return {} as Record<string, unknown>;
  try { return JSON.parse(text) as Record<string, unknown>; }
  catch { throw new Error(response.status === 413 ? "Image is too large for this upload. Please use an image under 4 MB." : `Upload request failed (${response.status}).`); }
}

async function getStyles(): Promise<StyleItem[]> {
  const response = await fetch("/api/dashboard/admin/content/styles", { cache: "no-store" });
  const data = await readResponse(response);
  if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Unable to load style photos.");
  return data.styles as StyleItem[];
}

const SERVICE_LABELS: Record<string, string> = {
  HAIRSTYLE: "Hairstyle", HAIR_COLOR: "Hair Colour", BUZZ_CUT: "Buzz Cut", BALD: "Bald", BEARD: "Beard", BEARD_REMOVAL: "Beard Removal",
};

const GENDER_LABELS: Record<string, string> = { FEMALE: "Women", MALE: "Men", UNISEX: "Unisex" };

function formatLabel(value: string | null) {
  if (!value) return "Uncategorized";
  return value.toLowerCase().split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

export function StylePhotoManager() {
  const [styles, setStyles] = useState<StyleItem[]>([]);
  const [serviceFilter, setServiceFilter] = useState("HAIRSTYLE");
  const [genderFilter, setGenderFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftPositions, setDraftPositions] = useState<Record<string, PhotoPosition>>({});
  const [dragState, setDragState] = useState<{ id: string; x: number; y: number } | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = async () => {
    setLoading(true); setError("");
    try { setStyles(await getStyles()); }
    catch (error) { setError(error instanceof Error ? error.message : "Unable to load style photos."); }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, []);

  const serviceStyles = useMemo(() => styles.filter((style) => style.serviceType === serviceFilter), [styles, serviceFilter]);
  const genderOptions = useMemo(() => Array.from(new Set(serviceStyles.map((style) => style.gender).filter(Boolean))).sort(), [serviceStyles]);
  const categoryOptions = useMemo(() => Array.from(new Set(serviceStyles.filter((style) => genderFilter === "ALL" || style.gender === genderFilter).map((style) => style.category).filter(Boolean) as string[])).sort(), [serviceStyles, genderFilter]);
  const visibleStyles = useMemo(() => serviceStyles.filter((style) => (genderFilter === "ALL" || style.gender === genderFilter) && (categoryFilter === "ALL" || style.category === categoryFilter)), [serviceStyles, genderFilter, categoryFilter]);
  const groupedStyles = useMemo(() => {
    const groups = new Map<string, StyleItem[]>();
    for (const style of visibleStyles) { const key = style.category || "UNCATEGORIZED"; groups.set(key, [...(groups.get(key) || []), style]); }
    return Array.from(groups.entries());
  }, [visibleStyles]);

  const changeService = (value: string) => { setServiceFilter(value); setGenderFilter("ALL"); setCategoryFilter("ALL"); };
  const changeGender = (value: string) => { setGenderFilter(value); setCategoryFilter("ALL"); };

  const beginPositionEdit = (style: StyleItem) => {
    if (!style.thumbnailUrl) return;
    setEditingId(style.id);
    setDraftPositions((current) => ({ ...current, [style.id]: getPhotoPosition(style.thumbnailUrl) }));
    setError(""); setNotice("");
  };

  const cancelPositionEdit = (style: StyleItem) => {
    setEditingId(null);
    setDraftPositions((current) => { const next = { ...current }; delete next[style.id]; return next; });
    setDragState(null);
  };

  const updateDraftPosition = (id: string, position: PhotoPosition) => {
    setDraftPositions((current) => ({ ...current, [id]: { x: clampPosition(position.x), y: clampPosition(position.y) } }));
  };

  const nudgePosition = (style: StyleItem, dx: number, dy: number) => {
    const current = draftPositions[style.id] || getPhotoPosition(style.thumbnailUrl);
    updateDraftPosition(style.id, { x: current.x + dx, y: current.y + dy });
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>, style: StyleItem) => {
    if (!editingId || editingId !== style.id || !style.thumbnailUrl) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragState({ id: style.id, x: event.clientX, y: event.clientY });
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>, style: StyleItem) => {
    if (!dragState || dragState.id !== style.id) return;
    const deltaX = event.clientX - dragState.x;
    const deltaY = event.clientY - dragState.y;
    if (Math.abs(deltaX) < 1 && Math.abs(deltaY) < 1) return;
    const current = draftPositions[style.id] || getPhotoPosition(style.thumbnailUrl);
    const rect = event.currentTarget.getBoundingClientRect();
    updateDraftPosition(style.id, {
      x: current.x - (deltaX / Math.max(rect.width, 1)) * 100,
      y: current.y + (deltaY / Math.max(rect.height, 1)) * 100,
    });
    setDragState({ id: style.id, x: event.clientX, y: event.clientY });
  };

  const endDrag = () => setDragState(null);

  const savePosition = async (style: StyleItem) => {
    if (!style.thumbnailUrl) return;
    const position = draftPositions[style.id] || getPhotoPosition(style.thumbnailUrl);
    setBusyId(style.id); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/dashboard/admin/content/styles/${style.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ thumbnailUrl: withPhotoPosition(style.thumbnailUrl, position) }) });
      const data = await readResponse(response);
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Unable to save photo position.");
      const updated = data.style as StyleItem;
      setStyles((current) => current.map((item) => item.id === style.id ? { ...item, thumbnailUrl: updated.thumbnailUrl } : item));
      setEditingId(null);
      setDraftPositions((current) => { const next = { ...current }; delete next[style.id]; return next; });
      setNotice(`${style.name} photo position saved.`);
    } catch (error) { setError(error instanceof Error ? error.message : "Unable to save photo position."); }
    finally { setBusyId(null); setDragState(null); }
  };

  const replacePhoto = async (style: StyleItem, file: File) => {
    setBusyId(style.id); setError(""); setNotice("");
    try {
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Use JPG, PNG or WebP.");
      if (file.size === 0 || file.size > MAX_UPLOAD_SIZE) throw new Error("Image must be between 1 byte and 4 MB.");
      const form = new FormData(); form.append("file", file);
      const uploadResponse = await fetch("/api/dashboard/admin/content/upload", { method: "POST", body: form });
      const uploadData = await readResponse(uploadResponse);
      if (!uploadResponse.ok) throw new Error(typeof uploadData.error === "string" ? uploadData.error : "Upload failed.");
      const uploadUrl = typeof uploadData.url === "string" ? uploadData.url : "";
      if (!uploadUrl) throw new Error("Upload completed without a media URL.");
      const patchResponse = await fetch(`/api/dashboard/admin/content/styles/${style.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ thumbnailUrl: uploadUrl }) });
      const patchData = await readResponse(patchResponse);
      if (!patchResponse.ok) throw new Error(typeof patchData.error === "string" ? patchData.error : "Unable to save style photo.");
      const updated = patchData.style as StyleItem;
      setStyles((current) => current.map((item) => item.id === style.id ? { ...item, thumbnailUrl: updated.thumbnailUrl } : item));
      setNotice(`${style.name} photo updated.`);
    } catch (error) { setError(error instanceof Error ? error.message : "Unable to update style photo."); }
    finally { setBusyId(null); }
  };

  const removePhoto = async (style: StyleItem) => {
    if (!style.thumbnailUrl) return;
    if (!window.confirm(`Remove the thumbnail for ${style.name}? The hairstyle itself will remain.`)) return;
    setBusyId(style.id); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/dashboard/admin/content/styles/${style.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ thumbnailUrl: null }) });
      const data = await readResponse(response);
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Unable to remove style photo.");
      setStyles((current) => current.map((item) => item.id === style.id ? { ...item, thumbnailUrl: null } : item));
      setEditingId(null); setNotice(`${style.name} thumbnail removed.`);
    } catch (error) { setError(error instanceof Error ? error.message : "Unable to remove style photo."); }
    finally { setBusyId(null); }
  };

  if (loading) return <div className="rounded-editorial border border-brand-border bg-brand-surface p-5 shadow-sm">Loading style photos…</div>;

  return (
    <section className="rounded-editorial border border-brand-border bg-brand-surface p-6 shadow-sm">
      <div className="mb-5"><h2 className="text-xl font-semibold text-brand-ink">Style Photos</h2><p className="mt-1 text-sm text-brand-muted">Find reference thumbnails by service, gender and category. Upload, replace or reposition a thumbnail without changing prompts or generation settings.</p></div>
      {error ? <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div> : null}
      {notice ? <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">{notice}</div> : null}

      <div className="mb-6 grid gap-3 md:grid-cols-3">
        <label className="text-sm font-medium text-brand-ink">Service<select value={serviceFilter} onChange={(event) => changeService(event.target.value)} className="mt-1 w-full rounded-lg border border-brand-border bg-white px-3 py-2 text-sm">{Object.entries(SERVICE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="text-sm font-medium text-brand-ink">Gender<select value={genderFilter} onChange={(event) => changeGender(event.target.value)} className="mt-1 w-full rounded-lg border border-brand-border bg-white px-3 py-2 text-sm"><option value="ALL">All</option>{genderOptions.map((value) => <option key={value} value={value}>{GENDER_LABELS[value] || formatLabel(value)}</option>)}</select></label>
        <label className="text-sm font-medium text-brand-ink">Category<select value={categoryOptions.includes(categoryFilter) || categoryFilter === "ALL" ? categoryFilter : "ALL"} onChange={(event) => setCategoryFilter(event.target.value)} className="mt-1 w-full rounded-lg border border-brand-border bg-white px-3 py-2 text-sm"><option value="ALL">All categories</option>{categoryOptions.map((value) => <option key={value} value={value}>{formatLabel(value)}</option>)}</select></label>
      </div>

      <div className="mb-5 text-sm text-brand-muted">Showing <strong className="text-brand-ink">{visibleStyles.length}</strong> {SERVICE_LABELS[serviceFilter] || formatLabel(serviceFilter)} item{visibleStyles.length === 1 ? "" : "s"}.</div>

      {visibleStyles.length === 0 ? <p className="text-sm text-brand-muted">No content items match the selected filters.</p> : (
        <div className="space-y-8">
          {groupedStyles.map(([category, items]) => (
            <div key={category}>
              <div className="mb-3 flex items-center justify-between"><h3 className="text-base font-semibold text-brand-ink">{formatLabel(category)}</h3><span className="text-xs text-brand-muted">{items.length} style{items.length === 1 ? "" : "s"}</span></div>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((style) => {
                  const isEditing = editingId === style.id;
                  const position = draftPositions[style.id] || getPhotoPosition(style.thumbnailUrl);
                  return (
                    <article key={style.id} className="overflow-hidden rounded-xl border border-brand-border bg-white">
                      <div className={`relative aspect-[4/5] bg-brand-surface select-none ${isEditing ? "cursor-grab touch-none active:cursor-grabbing" : ""}`} onPointerDown={(event) => handlePointerDown(event, style)} onPointerMove={(event) => handlePointerMove(event, style)} onPointerUp={endDrag} onPointerCancel={endDrag} onPointerLeave={endDrag}>
                        {style.thumbnailUrl ? <img src={style.thumbnailUrl} alt={style.name} draggable={false} className="h-full w-full object-cover" style={{ objectPosition: `${position.x}% ${position.y}%`, pointerEvents: isEditing ? "none" : "auto" }} /> : <div className="flex h-full w-full items-center justify-center p-6 text-center text-sm text-brand-muted">No style photo</div>}
                        {isEditing ? <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-black/55 px-3 py-2 text-center text-xs font-medium text-white">Drag the photo to reposition it</div> : null}
                      </div>

                      <div className="p-4">
                        <div className="flex items-start justify-between gap-3"><div><h4 className="font-semibold text-brand-ink">{style.name}</h4><p className="mt-1 text-xs text-brand-muted">{GENDER_LABELS[style.gender] || formatLabel(style.gender)}</p></div><span className="rounded-full border border-brand-border px-2 py-1 text-[11px] text-brand-muted">{style.thumbnailUrl ? "Uploaded" : "Missing"}</span></div>
                        {isEditing ? (
                          <div className="mt-3 rounded-lg border border-brand-border bg-brand-surface p-3">
                            <div className="mb-2 text-xs text-brand-muted">{formatPosition(style.thumbnailUrl)}</div>
                            <div className="grid grid-cols-3 gap-2">
                              <div /><button type="button" onClick={() => nudgePosition(style, 0, 5)} disabled={busyId !== null} className="rounded-lg border border-brand-border bg-white px-3 py-2 text-sm font-semibold hover:bg-brand-canvas" aria-label="Move photo up">↑</button><div />
                              <button type="button" onClick={() => nudgePosition(style, 5, 0)} disabled={busyId !== null} className="rounded-lg border border-brand-border bg-white px-3 py-2 text-sm font-semibold hover:bg-brand-canvas" aria-label="Move photo left">←</button>
                              <button type="button" onClick={() => updateDraftPosition(style.id, DEFAULT_POSITION)} disabled={busyId !== null} className="rounded-lg border border-brand-border bg-white px-3 py-2 text-xs font-semibold hover:bg-brand-canvas" aria-label="Reset photo position">Reset</button>
                              <button type="button" onClick={() => nudgePosition(style, -5, 0)} disabled={busyId !== null} className="rounded-lg border border-brand-border bg-white px-3 py-2 text-sm font-semibold hover:bg-brand-canvas" aria-label="Move photo right">→</button><div />
                              <button type="button" onClick={() => nudgePosition(style, 0, -5)} disabled={busyId !== null} className="rounded-lg border border-brand-border bg-white px-3 py-2 text-sm font-semibold hover:bg-brand-canvas" aria-label="Move photo down">↓</button><div />
                            </div>
                            <div className="mt-3 flex gap-2"><button type="button" onClick={() => void savePosition(style)} disabled={busyId !== null} className="flex-1 rounded-lg bg-brand-ink px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{busyId === style.id ? "Saving…" : "Save Position"}</button><button type="button" onClick={() => cancelPositionEdit(style)} disabled={busyId !== null} className="rounded-lg border border-brand-border px-3 py-2 text-sm font-semibold disabled:opacity-50">Cancel</button></div>
                          </div>
                        ) : (
                          <div className="mt-3 flex flex-wrap gap-2">
                            <label className="inline-flex cursor-pointer rounded-lg bg-brand-ink px-3 py-2 text-sm font-semibold text-white">{busyId === style.id ? "Working…" : style.thumbnailUrl ? "Replace Photo" : "Upload Photo"}<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={busyId !== null} onChange={(event) => { const file = event.target.files?.[0]; event.currentTarget.value = ""; if (file) void replacePhoto(style, file); }} /></label>
                            {style.thumbnailUrl ? <><button type="button" onClick={() => beginPositionEdit(style)} disabled={busyId !== null} className="rounded-lg border border-brand-border px-3 py-2 text-sm font-semibold disabled:opacity-50">Adjust Position</button><button type="button" onClick={() => void removePhoto(style)} disabled={busyId !== null} className="rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 disabled:opacity-50">Remove Photo</button></> : null}
                          </div>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
