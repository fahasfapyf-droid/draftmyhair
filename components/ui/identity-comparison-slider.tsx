"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export interface IdentityComparisonSliderProps {
  originalImage: string;
  previewImage: string;
  alt?: string;
  className?: string;
  imageContainerClassName?: string;
  priority?: boolean;
  quality?: number;
  showTrustRow?: boolean;
}

export const IdentityComparisonSlider: React.FC<IdentityComparisonSliderProps> = ({
  originalImage,
  previewImage,
  alt = "Hairstyle preview comparison",
  className,
  imageContainerClassName,
  priority = false,
    quality = 90,
  showTrustRow = true,
}) => {
  const [position, setPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      if (!isDragging || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
      setPosition((x / rect.width) * 100);
    },
    [isDragging]
  );

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
      window.addEventListener("pointercancel", handlePointerUp);
    }
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [isDragging, handlePointerMove, handlePointerUp]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsDragging(true);
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    setPosition((x / rect.width) * 100);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
  e.preventDefault();
switch (e.key) {
case "ArrowLeft":
setPosition((p) => Math.max(0, p - 5));
break;

case "ArrowRight":
setPosition((p) => Math.min(100, p + 5));
break;

case "Home":
setPosition(0);
break;

case "End":
setPosition(100);
break;
}
};
  // Trust Row Animation Variants
  const trustContainerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2,
      },
    },
  };

  const trustItemVariants = {
    hidden: { opacity: 0, y: 4 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] },
    },
  };

  return (
    <div className={cn("flex flex-col w-full h-full", className)}>
      {/* Image Container 
        Uses flex-1 so it naturally fills the parent's height minus the trust row below.
      */}
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        className={cn(
"relative flex-1 w-full overflow-hidden select-none touch-none rounded-md bg-brand-border group",
isDragging ? "cursor-grabbing" : "cursor-grabbing",
imageContainerClassName
)}      >
        {/* Original Image (Bottom Layer) */}
        <Image
          src={originalImage}
          alt={`Original - ${alt}`}
          fill
          sizes="100vw"
          priority={priority}
          quality={quality}
          className="object-cover pointer-events-none"
          draggable={false}
        />
        <div
          className={cn(
            "absolute bottom-4 left-4 z-10 px-3 py-1.5 bg-brand-surface/90 backdrop-blur text-brand-ink text-[10px] font-bold uppercase tracking-widest rounded shadow-sm transition-opacity duration-300",
            isDragging ? "opacity-100" : "opacity-70 group-hover:opacity-100"
          )}
        >
          YOUR PHOTO
        </div>

        {/* Preview Image (Top Layer - Clipped) */}
        <div
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{ clipPath: `inset(0 0 0 ${position}%)` }}
        >
          <Image
            src={previewImage}
            alt={`Preview - ${alt}`}
            fill
            sizes="100vw"
            priority={priority}
            quality={quality}
            className="object-cover"
            draggable={false}
          />
          <div
            className={cn(
              "absolute bottom-4 right-4 z-10 px-3 py-1.5 bg-brand-ink/90 backdrop-blur text-brand-surface text-[10px] font-bold uppercase tracking-widest rounded shadow-sm transition-opacity duration-300",
              isDragging ? "opacity-100" : "opacity-70 group-hover:opacity-100"
            )}
          >
            DRAFT MY HAIR
          </div>
        </div>

        {/* Draggable Divider & Handle */}
        <div
          className={cn(
            "absolute top-0 bottom-0 w-[1px] z-20 pointer-events-none transition-shadow transition-colors duration-300",
            isDragging
              ? "bg-white/80 shadow-[0_0_8px_rgba(255,255,255,0.35)]"
              : "shadow-[0_0_6px_rgba(255,255,255,0.25)]"
          )}
          style={{ left: `${position}%` }}
        >
          {/* Centering wrapper to prevent Tailwind transform conflicts */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none z-20">
            <div
              tabIndex={0}
              role="slider"
              aria-valuenow={Math.round(position)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Drag to compare images"
              onKeyDown={handleKeyDown}
              className={cn(
                "w-14 h-14 bg-brand-surface rounded-full flex items-center justify-center focus:outline-none focus:ring-4 focus:ring-brand-ink/20 pointer-events-auto transition-shadow transition-colors duration-300",
                isDragging
                  ? "cursor-grabbing scale-[1.08] shadow-[0_8px_24px_rgba(0,0,0,.16)]"
                  : "cursor-grab shadow-[0_4px_16px_rgba(0,0,0,0.1),0_1px_4px_rgba(0,0,0,0.05)] hover:scale-[1.03] hover:shadow-[0_6px_18px_rgba(0,0,0,0.12)]"
              )}
            >
              <div className="flex gap-1.5">
                <div className="w-[2px] h-3.5 bg-brand-muted rounded-full" />
                <div className="w-[2px] h-3.5 bg-brand-muted rounded-full" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {showTrustRow && (
  <>
    {/* Trust Row */}
    <motion.div
        variants={trustContainerVariants}
        initial="hidden"
        animate="visible"
        className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[11px] uppercase tracking-widest font-medium text-brand-muted"
      >
        <motion.span variants={trustItemVariants}>Face Preserved</motion.span>
        <motion.span variants={trustItemVariants} className="w-1 h-1 rounded-full bg-brand-border" />
        <motion.span variants={trustItemVariants}>Skin Preserved </motion.span>
        <motion.span variants={trustItemVariants} className="w-1 h-1 rounded-full bg-brand-border" />
        <motion.span variants={trustItemVariants}>Expression Preserved </motion.span>
        <motion.span variants={trustItemVariants} className="w-1 h-1 rounded-full bg-brand-border" />
        <motion.span variants={trustItemVariants} className="text-brand-ink font-semibold">Hair Transformed</motion.span>
      </motion.div>
  </>
)}
    </div>
  );
};
