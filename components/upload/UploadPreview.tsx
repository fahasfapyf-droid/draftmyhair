"use client";

import React from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

export interface UploadPreviewProps {
  imageUrl: string;
  onReplace?: () => void;
}

export const UploadPreview: React.FC<UploadPreviewProps> = ({
  imageUrl,
  onReplace,
}) => {
  const fadeUpVariants = {
    hidden: { opacity: 0, y: 16 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 1, ease: [0.16, 1, 0.3, 1] },
    },
  };

  return (
    <motion.div
      variants={fadeUpVariants}
      initial="hidden"
      animate="visible"
      className="w-full max-w-2xl mx-auto flex flex-col p-6 md:p-8 rounded-editorial bg-brand-surface border border-brand-border/60 shadow-sm"
    >
      {/* Image Preview Container */}
      <div className="relative w-full aspect-[3/4] sm:aspect-[4/5] overflow-hidden rounded-editorial border border-brand-border bg-brand-canvas shadow-sm">
        <Image
  src={imageUrl}
  alt="Uploaded portrait preview"
  fill
  sizes="(max-width: 768px) 100vw, 42rem"
  className="object-cover"
/>
      </div>

      {/* Trust Row */}
      <div className="mt-8 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[11px] uppercase tracking-widest font-semibold text-brand-muted">
        <span>Face Preserved</span>
        <span className="w-1 h-1 rounded-full bg-brand-border" aria-hidden="true" />
        <span>Skin Preserved</span>
        <span className="w-1 h-1 rounded-full bg-brand-border" aria-hidden="true" />
        <span>Expression Preserved</span>
        <span className="w-1 h-1 rounded-full bg-brand-border" aria-hidden="true" />
        <span className="text-brand-ink font-bold">Hair Transformed</span>
      </div>

      {/* Action Buttons */}
      <div className="mt-8 pt-6 border-t border-brand-border/50 flex flex-col sm:flex-row items-center justify-center gap-4">
        <Button
          type="button"
          variant="secondary"
          size="lg"
          onClick={() => onReplace?.()}
          className="w-full sm:w-auto"
        >
          Replace Photo
        </Button>
        <Button
          type="button"
          variant="primary"
          size="lg"
          disabled
          className="w-full sm:w-auto"
        >
          Continue
        </Button>
      </div>
    </motion.div>
  );
};