"use client";

import React from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { Container } from "@/components/ui/container";

// Future CMS Support Structure
export interface QualityStandard {
  id: string;
  order: number;
  title: string;
  description: string;
  image: string;
}

const standards: QualityStandard[] = [
  {
    id: "qs-identity",
    order: 1,
    title: "Identity Preservation",
    description: "Your facial features, proportions and expression remain unchanged.",
    image: "/images/standards/identity-placeholder.jpg",
  },
  {
    id: "qs-hair-only",
    order: 2,
    title: "Hair-Only Editing",
    description: "Only the selected hairstyle or beard changes. Everything else stays untouched.",
    image: "/images/standards/hair-only-placeholder.jpg",
  },
  {
    id: "qs-realism",
    order: 3,
    title: "Photographic Realism",
    description: "Lighting, colour and texture remain natural.",
    image: "/images/standards/realism-placeholder.jpg",
  },
  {
    id: "qs-integration",
    order: 4,
    title: "Natural Integration",
    description: "Hair blends naturally into the scalp without artificial edges.",
    image: "/images/standards/integration-placeholder.jpg",
  },
  {
    id: "qs-review",
    order: 5,
    title: "Quality Review",
    description: "Every preview is reviewed before delivery to ensure it meets our standard.",
    image: "/images/standards/review-placeholder.jpg",
  },
  {
    id: "qs-confidence",
    order: 6,
    title: "Decision Confidence",
    description: "The goal isn't simply to create an image. It's to help you make a confident real-world decision.",
    image: "/images/standards/confidence-placeholder.jpg",
  },
];

export const WhyDifferent = () => {
  // Editorial motion timings
  const ease = [0.16, 1, 0.3, 1];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 1, ease },
    },
  };

  const headerVariants = {
    hidden: { opacity: 0, y: 16 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 1, ease },
    },
  };

  return (
    <section className="py-24 md:py-32 bg-brand-canvas relative">
      <Container>
        <div className="flex flex-col lg:flex-row gap-16 lg:gap-24 items-start">
          
          {/* Left Column: Editorial Headline (Sticky on Desktop) */}
          <motion.div 
            className="w-full lg:w-1/3 lg:sticky lg:top-32"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={headerVariants}
          >
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold tracking-editorial text-brand-ink mb-6 text-balance leading-[1.1]">
              Why Draft My Hair Looks Different
            </h2>
            <p className="text-lg text-brand-muted leading-relaxed max-w-md">
              Every preview is created against the same quality standard. If it doesn&apos;t look like a real photograph, it doesn&apos;t meet ours.
            </p>
          </motion.div>

          {/* Right Column: Quality Standard Cards */}
          <motion.div 
            className="w-full lg:w-2/3 flex flex-col gap-6"
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
          >
            {standards.map((standard) => (
              <motion.div
                key={standard.id}
                variants={itemVariants}
                className="group flex flex-col sm:flex-row items-start sm:items-center gap-6 p-6 md:p-8 rounded-editorial bg-brand-surface border border-brand-border/60 shadow-sm transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-brand-border hover:shadow-editorial hover:-translate-y-1"
              >
                {/* Small supporting visual placeholder */}
                <div className="relative w-full sm:w-28 shrink-0 aspect-[3/2] sm:aspect-square overflow-hidden rounded-[2px] bg-brand-border/30 border border-transparent transition-colors duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:border-brand-border/80">
                  <Image
                    src={standard.image}
                    alt={standard.title}
                    fill
                    sizes="(max-width: 640px) 100vw, 112px"
                    className="object-cover object-center opacity-85 transition-all duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:opacity-100 group-hover:scale-[1.05]"
                  />
                </div>

                {/* Card Typography */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] uppercase tracking-widest font-semibold text-brand-muted">
                      {String(standard.order).padStart(2, '0')}
                    </span>
                    <h3 className="text-xl font-medium tracking-tight text-brand-ink transition-colors duration-700 group-hover:text-brand-ink/80">
                      {standard.title}
                    </h3>
                  </div>
                  <p className="text-sm leading-relaxed text-brand-muted max-w-xl">
                    {standard.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </motion.div>

        </div>

        {/* Closing Statement */}
        <motion.div 
          className="mt-24 md:mt-32 pt-12 md:pt-16 border-t border-brand-border/80 flex flex-col items-center text-center max-w-2xl mx-auto"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          variants={headerVariants}
        >
          <span className="text-[10px] uppercase tracking-widest font-semibold text-brand-ink mb-3 block">
            Our Promise
          </span>
          <p className="text-base md:text-lg text-brand-muted font-medium tracking-tight text-balance leading-relaxed">
            If your preview changes anything beyond the requested hairstyle or beard, it doesn&apos;t meet our quality standard.
          </p>
        </motion.div>
      </Container>
    </section>
  );
};
