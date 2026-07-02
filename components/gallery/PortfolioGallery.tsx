"use client";

import { Container } from "@/components/ui/container";
import { IdentityComparisonSlider } from "@/components/ui/identity-comparison-slider";
import { portfolio } from "@/lib/portfolio";

export function PortfolioGallery() {
  return (
    <section className="py-24 bg-brand-canvas">
      <Container>
        <h1 className="text-5xl font-semibold tracking-editorial text-brand-ink">
          Gallery
        </h1>

        <p className="mt-4 text-lg text-brand-muted max-w-2xl">
  {portfolio.length} transformations available.
</p>

<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mt-16">
  {portfolio.map((item) => (
    <div
      key={item.id}
      className="rounded-2xl border border-brand-border p-4"
    >
      <IdentityComparisonSlider
  originalImage={item.before}
  previewImage={item.after}
  alt={item.title}
  showTrustRow={false}
  imageContainerClassName="aspect-[4/5] rounded-xl"
/>

      <h3 className="mt-4 text-xl font-semibold">
        {item.title}
      </h3>

      <p className="mt-1 text-sm text-brand-muted capitalize">
        {item.category}
      </p>
    </div>
  ))}
</div>
      </Container>
    </section>
  );
}