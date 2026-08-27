"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { IdentityComparisonSlider } from "@/components/ui/identity-comparison-slider";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { cn } from "@/lib/utils";

type CategoryKey = "hairstyle" | "hairColour" | "buzzCut" | "bald" | "beard" | "beardRemoval";

const previewCategories: Record<CategoryKey, { label: string; headline: string; copy: string; original: string; preview: string }> = {
  hairstyle: { label: "Hairstyles", headline: "See Your Next Hairstyle Before You Commit.", copy: "Photorealistic hairstyle previews that preserve your facial identity, lighting and proportions so you can choose with confidence.", original: "/portfolio/bob/french-bob-before.webp", preview: "/portfolio/bob/french-bob-after.webp" },
  hairColour: { label: "Hair Color", headline: "Preview Your Next Hair Color Before You Dye It.", copy: "Experiment with realistic hair colors while keeping your face, skin tone and lighting exactly the same.", original: "/portfolio/dye-color-change/dye-color-change-natural-black-to-blonde-before.webp", preview: "/portfolio/dye-color-change/dye-color-change-natural-black-to-blonde-after.webp" },
  buzzCut: { label: "Buzz Cut", headline: "See Your Buzz Cut Before You Shave.", copy: "Preview a realistic buzz cut before making the change. No guessing, no surprises.", original: "/portfolio/buzzcut/0mm-buzz-before.webp", preview: "/portfolio/buzzcut/0mm-buzz-after.webp" },
  bald: { label: "Bald Look", headline: "See Yourself Bald Before You Commit.", copy: "Thinking about shaving your head? Preview a natural bald look before making the decision.", original: "/portfolio/bald/clean-bald-before.webp", preview: "/portfolio/bald/clean-bald-after.webp" },
  beard: { label: "Beards", headline: "Find the Beard Style That Fits You.", copy: "Try different beard styles while preserving your natural facial features and proportions.", original: "/portfolio/beard/full-beard-before.webp", preview: "/portfolio/beard/full-beard-after.webp" },
  beardRemoval: { label: "Clean Shave", headline: "See Yourself Clean Shaven Before You Shave.", copy: "Preview a clean-shaven look with realistic identity preservation before picking up the razor.", original: "/portfolio/beard/clean-shave-before.webp", preview: "/portfolio/beard/clean-shave-after.webp" },
};

const uploadCategory = (key: CategoryKey) => key === "hairstyle" ? "hairstyle" : key === "hairColour" ? "hair-colour" : key === "buzzCut" ? "buzz-cut" : key === "bald" ? "bald" : key === "beard" ? "beard-style" : "beard-removal";

export const Hero = () => {
  const [activeCategory, setActiveCategory] = useState<CategoryKey>("hairstyle");
  const current = previewCategories[activeCategory];
  const uploadHref = `/upload?category=${uploadCategory(activeCategory)}`;

  const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.15, delayChildren: 0.1 } } };
  const textVariants = { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { duration: 1, ease: [0.16, 1, 0.3, 1] } } };
  const sliderVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { duration: 1.5, delay: 0.3, ease: [0.16, 1, 0.3, 1] } } };

  return (
    <section className="relative w-full pt-14 pb-16 md:pt-20 md:pb-24 lg:pt-24 lg:pb-28 overflow-hidden bg-brand-canvas">
      <Container>
        <div className="flex flex-col lg:flex-row items-center lg:items-stretch gap-12 lg:gap-16 xl:gap-24">
          <motion.div className="w-full lg:w-[45%] xl:w-[40%] flex flex-col justify-center order-1" variants={containerVariants} initial="hidden" animate="visible">
            <motion.span variants={textVariants} className="block text-[11px] font-semibold uppercase tracking-widest text-brand-muted mb-6">Photorealistic Hairstyle Previews</motion.span>
            <motion.div variants={textVariants} className="min-h-[160px] sm:min-h-[140px] md:min-h-[180px] lg:min-h-[220px] mb-4">
              <AnimatePresence mode="wait">
                <motion.div key={activeCategory} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}>
                  <h1 className="text-4xl md:text-5xl lg:text-[3.7rem] xl:text-[4.15rem] font-semibold tracking-editorial leading-[1.02] text-brand-ink mb-6 text-balance max-w-[12ch]">{current.headline}</h1>
                  <p className="text-lg md:text-xl text-brand-muted tracking-tight max-w-md leading-relaxed">{current.copy}</p>
                </motion.div>
              </AnimatePresence>
            </motion.div>
            <motion.div variants={textVariants} className="mb-10">
              <h3 className="text-sm font-medium tracking-tight text-brand-ink mb-4">Choose a preview</h3>
              <div className="flex flex-wrap gap-2 md:gap-3">
                {(Object.keys(previewCategories) as CategoryKey[]).map((key) => {
                  const isActive = key === activeCategory;
                  return <button key={key} onClick={() => setActiveCategory(key)} className={cn("px-4 py-2 rounded-full text-xs sm:text-sm font-medium transition-all duration-300 tracking-tight", isActive ? "bg-brand-ink text-brand-canvas shadow-sm pointer-events-none" : "bg-transparent text-brand-muted border border-brand-border/80 hover:border-brand-ink/40 hover:text-brand-ink")}>{previewCategories[key].label}</button>;
                })}
              </div>
            </motion.div>
            <motion.div variants={textVariants} className="flex flex-col sm:flex-row items-center gap-4">
              <Button asChild variant="primary" size="lg" className="w-full sm:w-auto">
                <Link href={uploadHref}>Try it on your photo</Link>
              </Button>
              <Button asChild variant="secondary" size="lg" className="w-full sm:w-auto">
                <Link href="/gallery">Browse examples</Link>
              </Button>
            </motion.div>
            <motion.div variants={textVariants}><p className="mt-8 text-[10px] uppercase tracking-widest font-medium text-brand-muted">Professional previews with identity-preserving editing.</p></motion.div>
          </motion.div>
          <motion.div className="w-full lg:w-[55%] xl:w-[60%] order-2 flex items-center justify-center lg:justify-end" variants={sliderVariants} initial="hidden" animate="visible">
            <div className="relative w-full max-w-[720px] lg:max-w-none aspect-[4/5] min-h-[420px] sm:min-h-[520px] md:min-h-[620px] lg:min-h-[700px]">
              <AnimatePresence>
                <motion.div key={activeCategory} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }} className="absolute inset-0 w-full h-full">
                  <IdentityComparisonSlider originalImage={current.original} previewImage={current.preview} alt={`${current.label} preview comparison showing exact identity preservation`} priority={true} quality={75} sizes="(max-width: 1024px) 100vw, 60vw" imageContainerClassName="w-full h-full shadow-editorial" />
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      </Container>
    </section>
  );
};
