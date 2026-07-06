"use client";

import React, { useState, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";

export interface Transformation {
  id: string;
  category: string;
  title: string;
  description: string;
  image: string;
  href: string;
  featured: boolean;
}

const transformations: Transformation[] = [
  {
    id: "long-layers",
    category: "Long Hair",
    title: "Long Layers",
    description: "",
    image: "/portfolio/layers/long-layers-after.webp",
    href: "/gallery",
    featured: true,
  },
  {
    id: "wolf-cut",
    category: "Long Hair",
    title: "Wolf Cut",
    description: "",
    image: "/portfolio/layers/wolf-cut-after.webp",
    href: "/gallery",
    featured: true,
  },
  {
    id: "french-bob",
    category: "Short Hair",
    title: "French Bob",
    description: "",
    image: "/portfolio/bob/french-bob-after.webp",
    href: "/gallery",
    featured: true,
  },
  {
    id: "pixie",
    category: "Short Hair",
    title: "Pixie Cut",
    description: "",
    image: "/portfolio/pixie/side-fringe-pixie-after.webp",
    href: "/gallery",
    featured: true,
  },
  {
    id: "hair-colour",
    category: "Hair Color",
    title: "Natural Black → Blonde",
    description: "",
    image: "/portfolio/dye-color-change/dye-color-change-natural-black-to-blonde-after.webp",
    href: "/gallery",
    featured: true,
  },
  {
    id: "buzz",
    category: "Buzz & Bald",
    title: "0mm Buzz Cut",
    description: "",
    image: "/portfolio/buzzcut/0mm-buzz-after.webp",
    href: "/gallery",
    featured: true,
  },
  {
    id: "bald",
    category: "Buzz & Bald",
    title: "Clean Bald",
    description: "",
    image: "/portfolio/bald/clean-bald-after.webp",
    href: "/gallery",
    featured: true,
  },
  {
    id: "beard",
    category: "Beards",
    title: "Full Beard",
    description: "",
    image: "/portfolio/beard/full-beard-after.webp",
    href: "/gallery",
    featured: true,
  },
  {
    id: "clean-shave",
    category: "Beards",
    title: "Clean Shave",
    description: "",
    image: "/portfolio/beard/clean-shave-after.webp",
    href: "/gallery",
    featured: true,
  },
];

const FILTERS = [
  "All",
  "Long Hair",
  "Short Hair",
  "Hair Color",
  "Buzz & Bald",
  "Beards",
] as const;

type FilterType = typeof FILTERS[number];

export const RealTransformations = () => {
  const [activeFilter, setActiveFilter] = useState<FilterType>("All");

  const filteredTransformations = useMemo(() => {
    if (activeFilter === "All") return transformations.filter(t => t.featured);
    return transformations.filter((t) => t.category === activeFilter && t.featured);
  }, [activeFilter]);

  const itemVariants = {
    hidden: { opacity: 0, y: 12 },
    visible: { 
      opacity: 1, y: 0, 
      transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] } 
    },
    exit: { 
      opacity: 0, scale: 0.98,
      transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } 
    }
  };

  return (
    <section className="py-24 md:py-32 bg-brand-canvas">
      <Container>
        <motion.div 
          className="mb-12 md:mb-16 max-w-2xl"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        >
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold tracking-editorial text-brand-ink mb-4">
            Real Transformations
          </h2>
          <p className="text-lg text-brand-muted leading-relaxed">
            Every preview below was created while preserving the person's identity. Only the hair changes.
          </p>
        </motion.div>

        <motion.div 
          className="mb-12 md:mb-16 flex flex-wrap items-center gap-2 md:gap-3"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1, delay: 0.2 }}
        >
          {FILTERS.map((filter) => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={cn(
                "px-4 py-2 text-xs md:text-sm font-medium rounded-full border transition-all duration-500 ease-[0.16,1,0.3,1] outline-none focus-visible:ring-2 focus-visible:ring-brand-ink focus-visible:ring-offset-2 focus-visible:ring-offset-brand-canvas",
                activeFilter === filter
                  ? "bg-brand-ink border-brand-ink text-brand-surface shadow-sm"
                  : "bg-transparent border-brand-border text-brand-muted hover:border-brand-ink/30 hover:text-brand-ink"
              )}
            >
              {filter}
            </button>
          ))}
        </motion.div>

        {/* Removed min-h-[600px] to allow natural reflow */}
        <motion.div 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          layoutRoot
        >
          <motion.div layout className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-16">
            <AnimatePresence mode="popLayout">
              {filteredTransformations.map((item) => (
                <motion.div
                  key={item.id}
                  layout
                  variants={itemVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                >
                  <Link href={item.href} className="group flex flex-col focus:outline-none">
                    <div className="relative aspect-[4/5] w-full overflow-hidden rounded-editorial bg-brand-border/30 mb-5 border border-transparent transition-colors duration-700 ease-[0.16,1,0.3,1] group-hover:border-brand-border group-focus-visible:ring-2 group-focus-visible:ring-brand-ink group-focus-visible:ring-offset-4 group-focus-visible:ring-offset-brand-canvas">
                      <Image
                        src={item.image}
                        alt={item.title}
                        fill
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        className="object-cover object-center transition-transform duration-1000 ease-[0.16,1,0.3,1] group-hover:scale-[1.03]"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5 px-1">
                      <span className="text-[10px] uppercase tracking-widest font-semibold text-brand-muted">
                        {item.category}
                      </span>
                      <h3 className="text-xl font-medium tracking-tight text-brand-ink mt-1">
                        {item.title}
                      </h3>
                      {item.description && (
  <p className="text-sm leading-relaxed text-brand-muted mt-1">
    {item.description}
  </p>
)}
                      <div className="mt-4 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-brand-ink">
                        <span className="relative overflow-hidden">
                          View Example
                          <span className="absolute -bottom-1 left-0 w-full h-[1px] bg-brand-ink origin-left scale-x-0 transition-transform duration-500 ease-[0.16,1,0.3,1] group-hover:scale-x-100" />
                        </span>
                        <ArrowRight className="w-3.5 h-3.5 transition-transform duration-500 ease-[0.16,1,0.3,1] group-hover:translate-x-1" />
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>

          {filteredTransformations.length === 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full py-20 text-center text-brand-muted">
              <p>More examples in this category are coming soon.</p>
            </motion.div>
          )}
        </motion.div>

        <motion.div 
          className="mt-20 pt-12 border-t border-brand-border flex justify-center"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        >
          <Button variant="secondary" size="lg">
           View 150+ Transformations
          </Button>
        </motion.div>

      </Container>
    </section>
  );
};