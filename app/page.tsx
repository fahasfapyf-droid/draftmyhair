import type { Metadata } from "next";
import { Hero } from "@/components/home/Hero";
import { PreviewCategories } from "@/components/home/PreviewCategories";
import { ProofSection } from "@/components/home/ProofSection";
import { RealTransformations } from "@/components/home/RealTransformations";
import { HowItWorks } from "@/components/home/HowItWorks";
import { Testimonials } from "@/components/home/Testimonials";
import { ForSalons } from "@/components/home/ForSalons";
import { createPageMetadata } from "./metadata";
import { PricingSection } from "@/components/home/PricingSection";

export const metadata: Metadata = createPageMetadata({
  title: "See Your Next Hairstyle Before You Cut It.",
  description:
    "Try realistic AI hairstyle, beard, bald and hair colour previews while keeping your face recognisably yours.",
  path: "/",
});

export default function HomePage() {
  return (
    <main>
      <Hero />
      <PreviewCategories />
      <ProofSection />
      <RealTransformations />
      <HowItWorks />
      <PricingSection />
      <ForSalons />
    </main>
  );
}
