"use client";

import React from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";

export interface SynchronizedComparisonProps {
  before: string;
  after: string;
  beforeLabel?: string;
  afterLabel?: string;
  zoom?: number;
}

// Premium physics spring configuration for fluid, zero-lag camera movement
const SPRING_CONFIG = { damping: 40, stiffness: 350, mass: 0.5 };

export const SynchronizedComparison: React.FC<SynchronizedComparisonProps> = ({
  before,
  after,
  beforeLabel = "YOUR PHOTO",
  afterLabel = "DRAFT MY HAIR",
  zoom = 2.5,
}) => {
  // Motion values track the normalized coordinates (0.0 to 1.0) and hover state
  const rawNX = useMotionValue(0.5);
  const rawNY = useMotionValue(0.5);
  const rawHover = useMotionValue(0);

  // Apply physics-based springs to eliminate snapping and layout thrashing
  const springNX = useSpring(rawNX, SPRING_CONFIG);
  const springNY = useSpring(rawNY, SPRING_CONFIG);
  const springHover = useSpring(rawHover, SPRING_CONFIG);

  // Derive the target scale dynamically
  const scale = useTransform(() => 1 + (zoom - 1) * springHover.get());

  // Derive exact GPU-accelerated translation percentages.
  // The inverse mapping formula mathematically binds the focal point to the cursor 
  // without relying on error-prone pixel calculations or transform-origin tricks.
  const x = useTransform(() => `${(0.5 - springNX.get()) * (scale.get() - 1) * 100}%`);
  const y = useTransform(() => `${(0.5 - springNY.get()) * (scale.get() - 1) * 100}%`);

  const handlePointerEnter = () => rawHover.set(1);

  const handlePointerLeave = () => {
    rawHover.set(0);
    rawNX.set(0.5);
    rawNY.set(0.5);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    // getBoundingClientRect is safe here as no DOM writes occur in this cycle, preventing layout thrashing
    const rect = e.currentTarget.getBoundingClientRect();
    const paneWidth = rect.width / 2;

    // Determine which pane is active to ensure seamless cursor tracking across the boundary
    const isLeftPane = e.clientX < rect.left + paneWidth;
    const relativeX = isLeftPane
      ? e.clientX - rect.left
      : e.clientX - rect.left - paneWidth;
    const relativeY = e.clientY - rect.top;

    // Normalize coordinates to 0.0 - 1.0 within the active pane
    let nx = relativeX / paneWidth;
    let ny = relativeY / rect.height;

    // Strict boundary clamping prevents the camera from exposing empty background space
    nx = Math.max(0, Math.min(nx, 1));
    ny = Math.max(0, Math.min(ny, 1));

    // Defer DOM updates to Framer Motion's internal requestAnimationFrame loop
    rawNX.set(nx);
    rawNY.set(ny);
  };

  return (
    <div
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onPointerMove={handlePointerMove}
      className="relative flex w-full aspect-[4/5] sm:aspect-[4/3] md:aspect-video rounded-2xl overflow-hidden bg-neutral-100 shadow-sm border border-neutral-200/50 cursor-crosshair focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-4"
      tabIndex={0}
      aria-label="Synchronized forensic image comparison. Hover to zoom and move your cursor to inspect details."
    >
      {/* BEFORE PANE */}
      <div className="relative w-1/2 h-full overflow-hidden border-r border-neutral-200/50 z-10 pointer-events-none">
        <motion.img
          src={before}
          alt="Original portrait before changes"
          style={{ x, y, scale }}
          className="w-full h-full object-cover origin-center will-change-transform"
        />
        {beforeLabel && (
          <div className="absolute top-4 left-4 z-20 px-3 py-1.5 bg-white/95 text-neutral-900 text-[10px] font-bold uppercase tracking-widest rounded shadow-sm select-none backdrop-blur-sm">
            {beforeLabel}
          </div>
        )}
      </div>

      {/* AFTER PANE */}
      <div className="relative w-1/2 h-full overflow-hidden z-10 pointer-events-none">
        <motion.img
          src={after}
          alt="Preview portrait after changes"
          style={{ x, y, scale }}
          className="w-full h-full object-cover origin-center will-change-transform"
        />
        {afterLabel && (
          <div className="absolute top-4 left-4 z-20 px-3 py-1.5 bg-neutral-900/95 text-white text-[10px] font-bold uppercase tracking-widest rounded shadow-sm select-none backdrop-blur-sm">
            {afterLabel}
          </div>
        )}
      </div>
    </div>
  );
};