"use client";

import { useEffect, useState } from "react";

type StyleItem = {
  id: string;
  name: string;
  thumbnailUrl: string | null;
  serviceType: string;
};

async function getStyles(): Promise<StyleItem[]> {
  const response = await fetch("/api/dashboard/admin/content/styles", { cache: "no-store" });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "Unable to load hairstyles.");
  return data.styles as StyleItem[];
}

export function StylePhotoManager() {
  const [styles, setStyles] = useState<StyleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const items = await getStyles();
      setStyles(items.filter((item) => item.serviceType === "HAIRSTYLE"));
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to load hairstyles.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const replacePhoto = async (style: StyleItem, file: File) => {
    setBusyId(style.id);
    setError("");
    setNotice("");

    try {
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        throw new Error("Use JPG, PNG or WebP.");
      }
      if (file.size > 10 * 1024 * 1024) {
        throw new Error("Image must be 10 MB or smaller.");
      }

      const form = new FormData();
      form.append("file", file);
      const uploadResponse = await fetch("/api/dashboard/admin/content/upload", {
        method: "POST",
        body: form,
      });
      const uploadData = await uploadResponse.json();
      if (!uploadResponse.ok) throw new Error(uploadData.error ?? "Upload failed.");

      const patchResponse = await fetch(`/api/dashboard/admin/content/styles/${style.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thumbnailUrl: uploadData.url }),
      });
      const patchData = await patchResponse.json();
      if (!patchResponse.ok) throw new Error(patchData.error ?? "Unable to save style photo.");

      const updated = patchData.style as StyleItem;
      setStyles((current) => current.map((item) => item.id === style.id ? { ...item, thumbnailUrl: updated.thumbnailUrl } : item));
      setNotice(`${style.name} photo updated.`);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to update style photo.");
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return <div className="rounded-editorial border border-brand-border bg-brand-surface p-5 shadow-sm">Loading style photos…</div>;
  }

  return (
    <section className="rounded-editorial border border-brand-border bg-brand-surface p-6 shadow-sm">
      <div className="mb-5">
        <h2 className="text-xl font-semibold text-brand-ink">Style Photos</h2>
        <p className="mt-1 text-sm text-brand-muted">
          Upload or replace the reference thumbnail for an existing hairstyle. This changes only its thumbnail photo.
        </p>
      </div>

      {error ? <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div> : null}
      {notice ? <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">{notice}</div> : null}

      {styles.length === 0 ? (
        <p className="text-sm text-brand-muted">No hairstyle content items found.</p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {styles.map((style) => (
            <article key={style.id} className="overflow-hidden rounded-xl border border-brand-border bg-white">
              <div className="aspect-[4/5] bg-brand-surface">
                {style.thumbnailUrl ? (
                  <img src={style.thumbnailUrl} alt={style.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center p-6 text-center text-sm text-brand-muted">No style photo</div>
                )}
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-brand-ink">{style.name}</h3>
                <label className="mt-3 inline-flex cursor-pointer rounded-lg bg-brand-ink px-3 py-2 text-sm font-semibold text-white">
                  {busyId === style.id ? "Uploading…" : style.thumbnailUrl ? "Replace Photo" : "Upload Photo"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    disabled={busyId !== null}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.currentTarget.value = "";
                      if (file) void replacePhoto(style, file);
                    }}
                  />
                </label>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
