import { Hero } from "@/components/home/Hero";
import { PreviewCategories } from "@/components/home/PreviewCategories";
import { ProofSection } from "@/components/home/ProofSection";
import { RealTransformations } from "@/components/home/RealTransformations";
import { HowItWorks } from "@/components/home/HowItWorks";
import { Testimonials } from "@/components/home/Testimonials";
import { ForSalons } from "@/components/home/ForSalons";

export default function HomePage() {
  return (
    <main>
      <Hero />
      <PreviewCategories />
      <ProofSection />
      <RealTransformations />
      <HowItWorks />
      <ForSalons />
    </main>
  );
}