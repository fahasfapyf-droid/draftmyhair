"use client";

import React from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { HairStyle } from "@/lib/api/hairstyles";

interface StyleCardProps {
  style: HairStyle;
  isSelected: boolean;
  onClick: () => void;
}

export const StyleCard: React.FC<StyleCardProps> = ({
  style,
  isSelected,
  onClick,
}) => {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      className="group relative flex w-full flex-col rounded-editorial text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ink focus-visible:ring-offset-4 focus-visible:ring-offset-brand-canvas"
      whileTap={{ scale: 0.98 }}
      animate={{ y: isSelected ? -6 : 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      aria-pressed={isSelected}
    >
      <div
        className={cn(
          "relative w-full aspect-[3/4] rounded-editorial overflow-hidden mb-4 transition-all duration-500 ease-[0.16,1,0.3,1] bg-brand-border/20",
          isSelected
            ? "ring-2 ring-brand-ink ring-offset-4 ring-offset-brand-canvas shadow-editorial border-transparent"
            : "border border-brand-border/40 group-hover:border-brand-border group-hover:shadow-sm",
        )}
      >
        {style.thumbnailUrl ? (
          <Image
            src={style.thumbnailUrl}
            alt={`Preview of ${style.name}`}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
            unoptimized={style.thumbnailUrl.startsWith("/api/gallery/media")}
            className={cn(
              "object-cover transition-transform duration-1000 ease-[0.16,1,0.3,1]",
              isSelected ? "scale-105" : "group-hover:scale-105",
            )}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-brand-surface px-6 text-center">
            <span className="text-xs font-medium uppercase tracking-widest text-brand-muted">
              Preview image coming soon
            </span>
          </div>
        )}

        <div
          className={cn(
            "absolute inset-0 bg-brand-ink/0 transition-colors duration-500",
            !isSelected && "group-hover:bg-brand-ink/5",
          )}
        />
      </div>

      <div className="flex items-center justify-between px-1 w-full">
        <h3
          className={cn(
            "text-sm tracking-tight transition-colors duration-300",
            isSelected
              ? "font-semibold text-brand-ink"
              : "font-medium text-brand-muted group-hover:text-brand-ink",
          )}
        >
          {style.name}
        </h3>

        {isSelected && (
          <motion.div
            layoutId="selection-indicator"
            className="w-1.5 h-1.5 rounded-full bg-brand-ink shrink-0"
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          />
        )}
      </div>
    </motion.button>
  );
};
