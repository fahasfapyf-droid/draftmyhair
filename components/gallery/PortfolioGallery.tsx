"use client";

import { useEffect, useState } from "react";
import { Container } from "@/components/ui/container";
import { IdentityComparisonSlider } from "@/components/ui/identity-comparison-slider";
import { portfolio } from "@/lib/portfolio";

type ManagedItem = { id: string; title: string; category: string; beforeUrl: string; afterUrl: string; featured: boolean };

export function PortfolioGallery() {
  const [managed, setManaged] = useState<ManagedItem[] | null>(null);

  useEffect(() => {
    fetch("/api/gallery", { cache: "no-store" })
      .then(async (response) => response.ok ? (await response.json()).items as ManagedItem[] : [])
      .then((items) => setManaged(items))
      .catch(() => setManaged([]));
  }, []);

  const items = managed && managed.length > 0
    ? managed
    : portfolio.map((item) => ({ id: item.id, title: item.title, category: item.category, beforeUrl: item.before, afterUrl: item.after, featured: Boolean(item.featured) }));

  return (
    <section className="bg-brand-canvas py-24">
      <Container>
        <h1 className="text-5xl font-semibold tracking-editorial text-brand-ink">Gallery</h1>
        <p className="mt-4 max-w-2xl text-lg text-brand-muted">{items.length} transformations available.</p>
        <div className="mt-16 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <div key={item.id} className="rounded-2xl border border-brand-border p-4">
              <IdentityComparisonSlider originalImage={item.beforeUrl} previewImage={item.afterUrl} alt={item.title} showTrustRow={false} imageContainerClassName="aspect-[4/5] rounded-xl" />
              <h3 className="mt-4 text-xl font-semibold">{item.title}</h3>
              <p className="mt-1 text-sm capitalize text-brand-muted">{item.category}</p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
