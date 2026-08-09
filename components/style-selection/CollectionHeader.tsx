"use client";

import React from "react";
import { motion } from "framer-motion";

import type { HairstyleGender, HairstyleServiceType } from "@/lib/api/hairstyles";

const SERVICE_LABELS: Record<HairstyleServiceType, string> = {
  HAIRSTYLE: "Haircuts & Hairstyles",
  HAIR_COLOR: "Hair Colour",
  BUZZ_CUT: "Buzz Cut",
  BALD: "Bald",
  BEARD: "Beard",
  BEARD_REMOVAL: "Beard Removal",
};

const AUDIENCE_LABELS: Record<HairstyleGender, string> = {
  FEMALE: "Women's Collection",
  MALE: "Men's Collection",
  UNISEX: "Unisex Collection",
};

type CollectionHeaderProps = {
  gender: HairstyleGender;
  serviceType: HairstyleServiceType;
  styleCategory?: string;
};

function formatCategory(category?: string) {
  if (!category) return null;
  return category
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

export const CollectionHeader: React.FC<CollectionHeaderProps> = ({
  gender,
  serviceType,
  styleCategory,
}) => {
  const categoryLabel = formatCategory(styleCategory);
  const title = categoryLabel
    ? `${categoryLabel} ${SERVICE_LABELS[serviceType]}`
    : SERVICE_LABELS[serviceType];

  return (
    <motion.div
      className="text-center mb-10 md:mb-12"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
    >
      <span className="text-[10px] uppercase tracking-widest font-semibold text-brand-muted block mb-3">
        {AUDIENCE_LABELS[gender]}
      </span>
      <h1 className="text-3xl md:text-4xl lg:text-5xl font-semibold tracking-editorial text-brand-ink mb-4 text-balance">
        {title}
      </h1>
      <p className="text-base md:text-lg text-brand-muted max-w-lg mx-auto">
        Select a look to preview. Your identity, skin, expression, and facial structure remain preserved while the selected hair treatment is applied.
      </p>
    </motion.div>
  );
};
