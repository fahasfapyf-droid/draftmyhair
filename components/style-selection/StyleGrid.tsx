"use client";

import React from "react";
import { motion } from "framer-motion";

import type { HairStyle } from "@/lib/api/hairstyles";

import { StyleCard } from "./StyleCard";

interface StyleGridProps {
  styles: HairStyle[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export const StyleGrid: React.FC<StyleGridProps> = ({
  styles,
  selectedId,
  onSelect,
}) => {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.15,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 16 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.8,
        ease: [0.16, 1, 0.3, 1],
      },
    },
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-x-4 gap-y-10 md:gap-x-6 md:gap-y-12 w-full pb-40"
    >
      {styles.map((style) => (
        <motion.div key={style.id} variants={itemVariants}>
          <StyleCard
            style={style}
            isSelected={selectedId === style.id}
            onClick={() => onSelect(style.id)}
          />
        </motion.div>
      ))}
    </motion.div>
  );
};
