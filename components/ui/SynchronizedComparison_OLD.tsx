"use client";

import React, { useRef, useState, useEffect } from "react";
import { motion, useMotionValue, useSpring, useTransform, AnimatePresence } from "framer-motion";

export interface SynchronizedComparisonProps {
  before: string;
  after: string;
  beforeLabel?: string;
  afterLabel?: string;
  zoom?: number;
}

const ZOOM_SPRING = { damping: 35, stiffness: 200, mass: 0.6 };
const PAN_SPRING = { damping: 40, stiffness: 700, mass: 0.1 };

export const SynchronizedComparison: React.FC<SynchronizedComparisonProps> = ({
  before,
  after,
  beforeLabel = "YOUR PHOTO",
  afterLabel = "DRAFT MY HAIR",
  zoom = 2.2, 
}) => {
  const [showHint, setShowHint] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  
  const hasHovered = useRef(false);
  const hoverTimeout = useRef<NodeJS.Timeout | null>(null);
  const hintTimeout = useRef<NodeJS.Timeout | null>(null);

  const rawNX = useMotionValue(0.5);
  const rawNY = useMotionValue(0.5);
  const rawHover = useMotionValue(0);

  const springNX = useSpring(rawNX, PAN_SPRING);
  const springNY = useSpring(rawNY, PAN_SPRING);
  const springHover = useSpring(rawHover, ZOOM_SPRING);

  // Idiomatic Framer Motion for single-value derivation
  const scale = useTransform(springHover, (v) => 1 + (zoom - 1) * v);
  
  // Getter pattern is the standard FMv10+ approach for deriving from multiple motion values
  const x = useTransform(() => `${(0.5 - springNX.get()) * (scale.get() - 1) * 100}%`);
  const y = useTransform(() => `${(0.5 - springNY.get()) * (scale.get() - 1) * 100}%`);

  useEffect(() => {
    return () => {
      if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
      if (hintTimeout.current) clearTimeout(hintTimeout.current);
    };
  }, []);

  const handlePointerEnter = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsHovering(true);
    
    // Pre-seed coordinates on entry to completely eliminate the initial jump.
    // This ensures the pan springs are already positioned before the zoom scale animates.
    const rect = e.currentTarget.getBoundingClientRect();
    const paneWidth = rect.width / 2;
    const isLeftPane = e.clientX < rect.left + paneWidth;
    const paneLeftEdge = isLeftPane ? rect.left : rect.left + paneWidth;
    
    const initialNX = Math.max(0, Math.min((e.clientX - paneLeftEdge) / paneWidth, 1));
    const initialNY = Math.max(0, Math.min((e.clientY - rect.top) / rect.height, 1));
    
    rawNX.set(initialNX);
    rawNY.set(initialNY);

    if (!hasHovered.current) {
      hasHovered.current = true;
      setShowHint(true);
      hintTimeout.current = setTimeout(() => setShowHint(false), 3000);
    }

    hoverTimeout.current = setTimeout(() => {
      rawHover.set(1);
    }, 70);
  };

  const handlePointerLeave = () => {
    setIsHovering(false);
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
    
    rawHover.set(0);
    rawNX.set(0.5);
    rawNY.set(0.5);
    setShowHint(false);
  };

  const handlePanePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    let nx = (e.clientX - rect.left) / rect.width;
    let ny = (e.clientY - rect.top) / rect.height;

    nx = Math.max(0, Math.min(nx, 1));
    ny = Math.max(0, Math.min(ny, 1));

    rawNX.set(nx);
    rawNY.set(ny);
  };

  return (
    <div
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      className={`relative flex w-full aspect-[4/5] sm:aspect-[4/3] md:aspect-video rounded-2xl overflow-hidden bg-neutral-100 shadow-sm border border-neutral-200/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-4 ${
        isHovering ? "cursor-grabbing" : "cursor-grab"
      }`}
      tabIndex={0}
      aria-label="Synchronized forensic image comparison. Hover to inspect details."
    >
      <AnimatePresence>
        {showHint && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 px-5 py-2.5 bg-neutral-900/90 text-white text-[11px] font-medium tracking-wide rounded-full shadow-lg pointer-events-none backdrop-blur-sm"
          >
            Hover to inspect
          </motion.div>
        )}
      </AnimatePresence>

      {/* BEFORE PANE */}
      <div 
        onPointerMove={handlePanePointerMove}
        className="relative w-1/2 h-full overflow-hidden border-r border-neutral-200/50 z-10"
      >
        <motion.img
          src={before}
          alt="Original portrait before changes"
          style={{ x, y, scale }}
          className="w-full h-full object-cover origin-center will-change-transform pointer-events-none"
        />
        {beforeLabel && (
          <div className="absolute top-4 left-4 z-20 px-3 py-1.5 bg-white/95 text-neutral-900 text-[10px] font-bold uppercase tracking-widest rounded shadow-sm select-none backdrop-blur-sm pointer-events-none">
            {beforeLabel}
          </div>
        )}
      </div>

      {/* AFTER PANE */}
      <div 
        onPointerMove={handlePanePointerMove}
        className="relative w-1/2 h-full overflow-hidden z-10"
      >
        <motion.img
          src={after}
          alt="Preview portrait after changes"
          style={{ x, y, scale }}
          className="w-full h-full object-cover origin-center will-change-transform pointer-events-none"
        />
        {afterLabel && (
          <div className="absolute top-4 left-4 z-20 px-3 py-1.5 bg-neutral-900/95 text-white text-[10px] font-bold uppercase tracking-widest rounded shadow-sm select-none backdrop-blur-sm pointer-events-none">
            {afterLabel}
          </div>
        )}
      </div>
    </div>
  );
};