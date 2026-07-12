"use client";

import React from "react";
import { motion } from "framer-motion";

export const CollectionHeader = () => {
  return (
    <motion.div
      className="text-center mb-12 md:mb-16"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
    >
      <span className="text-[10px] uppercase tracking-widest font-semibold text-brand-muted block mb-3">
        Women&apos;s Collection
      </span>
      <h1 className="text-3xl md:text-4xl lg:text-5xl font-semibold tracking-editorial text-brand-ink mb-4 text-balance">
        Fresh Start
      </h1>
      <p className="text-base md:text-lg text-brand-muted max-w-lg mx-auto">
        Select a style to preview. Our system will preserve your exact identity while mapping the new cut naturally to your features.
      </p>
    </motion.div>
  );
};
