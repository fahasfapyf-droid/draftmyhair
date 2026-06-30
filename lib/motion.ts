/**
 * Centralized design tokens for Framer Motion and standard transitions.
 * Ensures all animations feel calm, deliberate, and premium.
 */
export const motionTokens = {
  transition: {
    calm: { type: "spring", stiffness: 70, damping: 20, mass: 1 },
    snappy: { type: "spring", stiffness: 200, damping: 24, mass: 1 },
    fade: { duration: 0.4, ease: [0.16, 1, 0.3, 1] }, // Apple-esque cubic bezier
  },
};