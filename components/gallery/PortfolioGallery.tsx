"use client";

import { useEffect, useState } from "react";
import { Container } from "@/components/ui/container";
import { IdentityComparisonSlider } from "@/components/ui/identity-comparison-slider";
import { portfolio } from "@/lib/portfolio";

type GalleryItem = { id: string; title: string; category: string | null; beforeUrl: string; afterUrl: string };

export function PortfolioGallery() {
  const [items, setItems] = useState<GalleryItem[]>(portfolio.map((item) => ({ id: item.id, title: item.title, category: item.category, beforeUrl: item.before, afterUrl: item.after })));

  useEffect(() => {
    let cancelled = false;
    fetch("/api/gallery", { cache: "no-store" })
      .then(async (response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!cancelled && Array.isArray(data) && data.length > 0) {
          setItems(data.map((item) => ({ id: item.id, title: item.title, category: item.category, beforeUrl: item.beforeUrl, afterUrl: item.afterUrl })));
        }
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  return (
    <section className="py-24 bg-brand-canvas">
      <Container>
        <h1 className="text-5xl font-semibold tracking-editorial text-brand-ink">Gallery</h1>
        <p className="mt-4 text-lg text-brand-muted max-w-2xl">{items.length} transformations available.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mt-16">
          {items.map((item) => (
            <div key={item.id} className="rounded-2xl border border-brand-border p-4">
              <IdentityComparisonSlider originalImage={item.beforeUrl} previewImage={item.afterUrl} alt={item.title} showTrustRow={false} imageContainerClassName="aspect-[4/5] rounded-xl" />
              <h3 className="mt-4 text-xl font-semibold">{item.title}</h3>
              <p className="mt-1 text-sm text-brand-muted capitalize">{item.category ?? "hairstyle"}</p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
