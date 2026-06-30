"use client";

import React from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { Container } from "@/components/ui/container";

// Data-driven proof cards utilizing comparison crops for forensic evidence
const proofCards = [
  {
    id: "face",
    title: "Face",
    description: "Your facial structure remains unchanged.",
    originalImage: "/images/proof/face-original.jpg",
    previewImage: "/images/proof/face-preview.jpg",
  },
  {
    id: "skin",
    title: "Skin",
    description: "Natural skin texture and tone are preserved.",
    originalImage: "/images/proof/skin-original.jpg",
    previewImage: "/images/proof/skin-preview.jpg",
  },
  {
    id: "expression",
    title: "Expression",
    description: "Your expression stays exactly the same.",
    originalImage: "/images/proof/expression-original.jpg",
    previewImage: "/images/proof/expression-preview.jpg",
  },
  {
    id: "lighting",
    title: "Lighting",
    description: "Original lighting and shadows are maintained.",
    originalImage: "/images/proof/lighting-original.jpg",
    previewImage: "/images/proof/lighting-preview.jpg",
  },
];

export const ProofSection = () => {
  // Calm, editorial staggered animations
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
        {/* Section Header */}
        <motion.div 
          className="mb-16 md:mb-24 max-w-2xl"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        >
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold tracking-editorial text-brand-ink mb-4">
            See What Doesn't Change
          </h2>
          <p className="text-lg text-brand-muted leading-relaxed">
            Every preview preserves your identity. Only your hair changes.
          </p>
        </motion.div>

        {/* 2x2 Grid Layout */}
        <motion.div 
          className="grid grid-cols-1 md:grid-cols-2 gap-x-12 lg:gap-x-16 gap-y-16 md:gap-y-24"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
        >
          {proofCards.map((card) => (
            <motion.div 
              key={card.id} 
              variants={itemVariants}
              className="group flex flex-col gap-6"
            >
              {/* Premium Comparison Container with Leica-style 3:2 aspect ratio */}
              <div className="relative aspect-[3/2] w-full overflow-hidden rounded-editorial bg-brand-border/30 border border-transparent transition-colors duration-700 ease-[0.16,1,0.3,1] group-hover:border-brand-border flex">
                
                {/* Original Crop (Left) */}
                <div className="relative w-1/2 h-full border-r border-brand-border/50 overflow-hidden">
                  <Image
                    src={card.originalImage}
                    alt={`Original ${card.title.toLowerCase()} crop`}
                    fill
                    sizes="(max-width: 768px) 50vw, 25vw"
                    className="object-cover object-center transition-transform duration-1000 ease-[0.16,1,0.3,1] group-hover:scale-[1.03]"
                  />
                  <div className="absolute top-4 left-4 z-10">
                    <span className="bg-brand-surface text-brand-ink text-[9px] uppercase tracking-widest font-semibold px-2.5 py-1.5 rounded-editorial shadow-sm">
                      YOUR PHOTO
                    </span>
                  </div>
                </div>

                {/* Draft My Hair Crop (Right) */}
                <div className="relative w-1/2 h-full overflow-hidden">
                  <Image
                    src={card.previewImage}
                    alt={`Draft My Hair ${card.title.toLowerCase()} crop`}
                    fill
                    sizes="(max-width: 768px) 50vw, 25vw"
                    className="object-cover object-center transition-transform duration-1000 ease-[0.16,1,0.3,1] group-hover:scale-[1.03]"
                  />
                  <div className="absolute top-4 left-4 z-10">
                    <span className="bg-brand-ink text-brand-surface text-[9px] uppercase tracking-widest font-semibold px-2.5 py-1.5 rounded-editorial shadow-sm">
                      DRAFT MY HAIR
                    </span>
                  </div>
                </div>

              </div>

              {/* Minimal Text Content with Thin Divider */}
              <div className="flex flex-col gap-4">
                <div className="w-full h-[1px] bg-brand-border transition-colors duration-700 ease-[0.16,1,0.3,1] group-hover:bg-brand-ink/20" />
                <div>
                  <h3 className="text-xl font-medium tracking-tight text-brand-ink mb-1.5">
                    {card.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-brand-muted">
                    {card.description}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </Container>
    </section>
  );
};