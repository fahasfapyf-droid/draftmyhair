"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";

// Future CMS Support Structure
export interface SalonBenefit {
  id: string;
  order: number;
  title: string;
  description: string;
  image: string; // Ready for CMS, though kept minimal in current UI
}

const benefits: SalonBenefit[] = [
  {
    id: "benefit-confidence",
    order: 1,
    title: "Improve Consultation Confidence",
    description: "Clients can visualise a new hairstyle before making a decision.",
    image: "/images/salons/confidence-placeholder.jpg",
  },
  {
    id: "benefit-uncertainty",
    order: 2,
    title: "Reduce Uncertainty",
    description: "Previewing styles helps clients feel more confident before committing.",
    image: "/images/salons/uncertainty-placeholder.jpg",
  },
  {
    id: "benefit-experience",
    order: 3,
    title: "Enhance Client Experience",
    description: "A more informed consultation creates a better salon experience.",
    image: "/images/salons/experience-placeholder.jpg",
  },
  {
    id: "benefit-future",
    order: 4,
    title: "Built for Future Integration",
    description: "Draft My Hair is designed to evolve into tools for salons, clinics and beauty professionals.",
    image: "/images/salons/future-placeholder.jpg",
  },
];

export const ForSalons = () => {
  // Editorial motion timings
  const ease = [0.16, 1, 0.3, 1];

  const fadeUpVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 1, ease },
    },
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.2,
      },
    },
  };

  const imageVariants = {
    hidden: { opacity: 0, scale: 0.98 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: { duration: 1.5, ease },
    },
  };

  return (
    <section className="py-24 md:py-32 bg-brand-canvas">
      <Container>
        <div className="flex flex-col lg:flex-row gap-16 lg:gap-24 items-center lg:items-start">
          
          {/* Left Column: Editorial Copy & Benefits */}
          <motion.div 
            className="w-full lg:w-1/2 flex flex-col order-1 lg:order-1"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={containerVariants}
          >
            <motion.div variants={fadeUpVariants} className="mb-12 md:mb-16">
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold tracking-editorial text-brand-ink mb-6 text-balance leading-[1.1]">
                Built for Modern Salons
              </h2>
              <p className="text-lg text-brand-muted leading-relaxed max-w-md">
                Help clients make confident decisions before the first cut.
              </p>
            </motion.div>

            {/* Benefit Cards (Minimalist Text List) */}
            <motion.div className="flex flex-col gap-8 mb-12 md:mb-16" variants={containerVariants}>
              {benefits.map((benefit) => (
                <motion.div 
                  key={benefit.id} 
                  variants={fadeUpVariants}
                  className="flex flex-col gap-2 relative pl-6 before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[2px] before:bg-brand-border hover:before:bg-brand-ink before:transition-colors before:duration-500"
                >
                  <h3 className="text-lg font-medium tracking-tight text-brand-ink">
                    {benefit.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-brand-muted max-w-md">
                    {benefit.description}
                  </p>
                </motion.div>
              ))}
            </motion.div>

            {/* CTAs */}
            <motion.div 
              variants={fadeUpVariants}
              className="flex flex-col sm:flex-row items-start sm:items-center gap-6"
            >
              <Button variant="primary" size="lg">
                Partner With Draft My Hair
              </Button>
              
              <Link 
                href="/salons" 
                className="group flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-brand-ink"
              >
                <span className="relative overflow-hidden">
                  Learn More About Salon Partnerships
                  <span className="absolute -bottom-1 left-0 w-full h-[1px] bg-brand-ink origin-left scale-x-0 transition-transform duration-500 ease-[0.16,1,0.3,1] group-hover:scale-x-100" />
                </span>
                <ArrowRight className="w-3.5 h-3.5 transition-transform duration-500 ease-[0.16,1,0.3,1] group-hover:translate-x-1" />
              </Link>
            </motion.div>
          </motion.div>

          {/* Right Column: Premium Photography */}
          <motion.div 
            className="w-full lg:w-1/2 order-2 lg:order-2"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={imageVariants}
          >
            <div className="relative w-full aspect-[4/5] overflow-hidden rounded-editorial bg-brand-border/30 border border-brand-border/50 shadow-sm">
              <Image
                src="/images/salons/consultation-placeholder.jpg"
                alt="A stylist consulting with a client viewing a hairstyle preview on a tablet"
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover object-center"
              />
            </div>
          </motion.div>

        </div>

        {/* Future Roadmap Callout */}
        <motion.div 
          className="mt-12 pt-8 border-t border-brand-border/80 flex flex-col items-center text-center max-w-xl mx-auto"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          variants={fadeUpVariants}
        >
          <span className="text-[10px] uppercase tracking-widest font-semibold text-brand-ink mb-3 block">
            Growing With Professionals
          </span>
          <p className="text-base md:text-lg text-brand-muted font-medium tracking-tight text-balance leading-relaxed">
            Today's consultation tool. Tomorrow's salon platform.
          </p>
        </motion.div>

      </Container>
    </section>
  );
};