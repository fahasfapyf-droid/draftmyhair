"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Container } from "@/components/ui/container";

const categories = [
  {
    id: "hairstyle",
    title: "Hairstyle Preview",
    description: "Explore new lengths, layers, and volumes tailored to your face shape.",
    image: "/portfolio/bob/old-money-bob-after.webp",
    href: "/preview/hairstyle"
  },
 {
  id: "hair-colour",
  title: "Hair Colour Preview",
  description: "Test subtle highlights or complete colour transformations instantly.",
  image: "/portfolio/dye-color-change/dye-color-change-natural-black-to-blonde-after.webp",
  href: "/preview/hair-colour",
},
  {
    id: "buzz-cut",
    title: "Buzz Cut Preview",
    description: "See your face with a precision buzz cut before committing to the clippers.",
   image: "/portfolio/buzzcut/0mm-buzz-after.webp",
    href: "/preview/buzz-cut"
  },
  {
    id: "bald",
    title: "Bald Preview",
    description: "Visualize a completely clean-shaven head with perfect skin integration.",
    image: "/portfolio/bald/clean-bald-after.webp",
    href: "/preview/bald"
  },
  {
    id: "beard-style",
    title: "Beard Style Preview",
    description: "Discover the perfect beard length and shape for your jawline.",
    image: "/portfolio/beard/full-beard-after.webp",
    href: "/preview/beard-style"
  },
  {
    id: "beard-removal",
    title: "Beard Removal Preview",
    description: "Reveal your clean-shaven face with accurate skin tone and chin structure.",
    image: "/portfolio/beard/clean-shave-after.webp",
    href: "/preview/beard-removal"
  }
];

export const PreviewCategories = () => {
  // Calm, editorial staggered animation
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

  const itemVariants = {
    hidden: { opacity: 0, y: 16 },
    visible: { 
      opacity: 1, 
      y: 0, 
      transition: { duration: 1, ease: [0.16, 1, 0.3, 1] } 
    },
  };

  return (
    <section className="py-24 md:py-32 bg-brand-canvas">
      <Container>
        <motion.div 
          className="mb-16 md:mb-24 flex flex-col items-center text-center"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        >
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold tracking-editorial text-brand-ink mb-4">
            Explore Preview Categories
          </h2>
          <p className="text-lg text-brand-muted max-w-xl">
            Choose what you'd like to preview.
          </p>
        </motion.div>

        <motion.div 
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-16"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
        >
          {categories.map((category) => (
            <motion.div key={category.id} variants={itemVariants}>
              <Link href={category.href} className="group block focus:outline-none">
                {/* Image Container with Hover Effects */}
                <div className="relative aspect-[4/5] w-full overflow-hidden rounded-editorial bg-brand-border/30 mb-6 border border-transparent transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:border-brand-border group-hover:shadow-editorial group-hover:-translate-y-1 group-focus-visible:ring-2 group-focus-visible:ring-brand-ink group-focus-visible:ring-offset-4 group-focus-visible:ring-offset-brand-canvas">
                  <Image
                    src={category.image}
                    alt={category.title}
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    className="object-cover object-top transition-transform duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-brand-ink/0 transition-colors duration-700 group-hover:bg-brand-ink/5" />
                </div>

                {/* Typography & Content */}
                <div className="flex flex-col gap-2 px-1">
                  <h3 className="text-xl font-medium tracking-tight text-brand-ink transition-colors group-hover:text-brand-ink/80">
                    {category.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-brand-muted">
                    {category.description}
                  </p>
                  <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-brand-ink overflow-hidden">
                    <span className="relative">
                      Explore
                      <span className="absolute -bottom-1 left-0 w-full h-[1px] bg-brand-ink origin-left scale-x-0 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-x-100" />
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-1" />
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      </Container>
    </section>
  );
};