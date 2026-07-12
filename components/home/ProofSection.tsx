"use client";

import React from "react";
import { motion } from "framer-motion";
import { Container } from "@/components/ui/container";
import { SynchronizedComparison } from "@/components/ui/SynchronizedComparison";

const proofCards = [
  {
    id: "face",
    title: "Face",
    description: "Your facial structure remains unchanged.",
    originalImage: "/images/proof/face-original.webp",
    previewImage: "/images/proof/face-preview.webp",
  },
  {
    id: "skin",
    title: "Skin",
    description: "Natural skin texture and tone are preserved.",
    originalImage: "/images/proof/skin-original.webp",
    previewImage: "/images/proof/skin-preview.webp",
  },
  {
    id: "expression",
    title: "Expression",
    description: "Your expression stays exactly the same.",
    originalImage: "/images/proof/expression-original.webp",
    previewImage: "/images/proof/expression-preview.webp",
  },
  {
    id: "lighting",
    title: "Lighting",
    description: "Original lighting and shadows are maintained.",
    originalImage: "/images/proof/lighting-original.webp",
    previewImage: "/images/proof/lighting-preview.webp",
  },
];

export const ProofSection = () => {
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
      transition: {
        duration: 1,
        ease: [0.16, 1, 0.3, 1],
      },
    },
  };

  return (
    <section className="py-24 md:py-32 bg-brand-canvas">
      <Container>

        <motion.div
          className="mb-16 md:mb-24 max-w-2xl"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        >
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold tracking-editorial text-brand-ink mb-4">
            See What Doesn&apos;t Change
          </h2>

          <p className="text-lg text-brand-muted leading-relaxed">
            Every preview preserves your identity. Only your hair changes.
          </p>
        </motion.div>

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
                            <SynchronizedComparison
                before={card.originalImage}
                after={card.previewImage}
                beforeLabel="YOUR PHOTO"
                afterLabel="DRAFT MY HAIR"
                zoom={3}
              />

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
