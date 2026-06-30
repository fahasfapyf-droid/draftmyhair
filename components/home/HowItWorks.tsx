"use client";

import React from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { Container } from "@/components/ui/container";

export interface ProcessStep {
  id: string;
  order: number;
  title: string;
  description: string;
  illustration: string;
}

const steps: ProcessStep[] = [
  {
    id: "step-upload",
    order: 1,
    title: "Upload Your Photo",
    description: "Start with one clear front-facing photo in natural lighting.",
    illustration: "/images/process/upload-placeholder.jpg",
  },
  {
    id: "step-identity",
    order: 2,
    title: "Identity Lock",
    description: "Your face, skin, expression, lighting and proportions are preserved before any transformation begins.",
    illustration: "/images/process/identity-lock-placeholder.jpg",
  },
  {
    id: "step-transformation",
    order: 3,
    title: "Hair Transformation",
    description: "Only the selected hairstyle, colour or beard changes while everything else remains untouched.",
    illustration: "/images/process/transformation-placeholder.jpg",
  },
  {
    id: "step-review",
    order: 4,
    title: "Quality Review",
    description: "Every preview is checked for realism, lighting consistency and natural integration before delivery.",
    illustration: "/images/process/review-placeholder.jpg",
  },
  {
    id: "step-receive",
    order: 5,
    title: "Receive Your Preview",
    description: "Review your transformation before making a real-world decision.",
    illustration: "/images/process/receive-placeholder.jpg",
  },
];

export const HowItWorks = () => {
  const ease = [0.16, 1, 0.3, 1];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.15, delayChildren: 0.1 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 1, ease } },
  };

  return (
    <section className="py-24 md:py-32 bg-brand-canvas overflow-hidden">
      <Container>
        <motion.div
          className="mb-20 md:mb-24 max-w-2xl text-center md:text-left mx-auto md:mx-0"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 1, ease }}
        >
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold tracking-editorial text-brand-ink mb-4 text-balance">
            How Your Preview Is Created
          </h2>
          <p className="text-lg text-brand-muted leading-relaxed">
            Every preview follows the same quality process to ensure only your hair changes.
          </p>
        </motion.div>

        <motion.div
          className="flex flex-col lg:flex-row gap-12 lg:gap-6 xl:gap-8"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
        >
          {steps.map((step, index) => (
            <motion.div key={step.id} variants={itemVariants} className="relative flex flex-col lg:flex-1 group">
              
              {/* Dynamic Node & Connecting Line Segment */}
              <div className="absolute left-0 top-0 lg:left-auto lg:top-auto z-10 lg:relative flex lg:justify-center mb-6 lg:mb-8">
                <div className="relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-brand-border bg-brand-canvas text-[10px] font-semibold text-brand-muted shadow-sm transition-colors duration-700 ease-[0.16,1,0.3,1] group-hover:border-brand-ink group-hover:text-brand-ink">
                  {step.order}
                </div>
                {/* Connecting tail to next node */}
                {index !== steps.length - 1 && (
                  <div className="absolute left-[11px] top-[24px] bottom-[-48px] lg:bottom-auto lg:top-[11px] lg:left-[24px] lg:right-[-24px] w-[1px] lg:w-auto lg:h-[1px] bg-brand-border/50 origin-top lg:origin-left" />
                )}
              </div>

              <div className="ml-12 lg:ml-0 flex flex-col h-full">
                <div className="relative aspect-square w-full max-w-[280px] lg:max-w-none overflow-hidden rounded-editorial bg-brand-border/30 border border-transparent transition-colors duration-700 ease-[0.16,1,0.3,1] group-hover:border-brand-border mb-6">
                  <Image
                    src={step.illustration}
                    alt={step.title}
                    fill
                    sizes="(max-width: 1024px) 280px, 20vw"
                    className="object-cover object-center transition-transform duration-1000 ease-[0.16,1,0.3,1] opacity-80 group-hover:opacity-100 group-hover:scale-[1.03]"
                  />
                  <div className="absolute inset-0 bg-brand-canvas/5 ring-1 ring-inset ring-brand-ink/5" />
                </div>
                <h3 className="text-lg font-medium tracking-tight text-brand-ink mb-2 transition-colors duration-700 group-hover:text-brand-ink/80">
                  {step.title}
                </h3>
                <p className="text-sm leading-relaxed text-brand-muted">
                  {step.description}
                </p>
              </div>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          className="mt-24 md:mt-32 pt-12 md:pt-16 border-t border-brand-border flex flex-col items-center text-center max-w-xl mx-auto"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 1, ease, delay: 0.2 }}
        >
          <span className="text-[10px] uppercase tracking-widest font-semibold text-brand-ink mb-3 block">
            Our Standard
          </span>
          <p className="text-base md:text-lg text-brand-muted font-medium tracking-tight text-balance">
            If a preview changes anything beyond the hair, it does not meet our quality standard.
          </p>
        </motion.div>
      </Container>
    </section>
  );
};