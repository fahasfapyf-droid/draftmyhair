"use client";

import React, { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { motion } from "framer-motion";

interface GenerationStatusProps {
  onComplete?: () => void;
}

const STEPS = [
  "Preserving your facial identity",
  "Matching your natural hair color",
  "Adapting to your lighting",
  "Blending every strand naturally",
  "Performing a final quality check",
];

export const GenerationStatus: React.FC<GenerationStatusProps> = ({
  onComplete,
}) => {
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    if (currentStep >= STEPS.length) {
      const timer = setTimeout(() => {
        onComplete?.();
      }, 800);

      return () => clearTimeout(timer);
    }

    const timer = setTimeout(() => {
      setCurrentStep((prev) => prev + 1);
    }, 1500);

    return () => clearTimeout(timer);
  }, [currentStep, onComplete]);

  return (
    <div className="w-full max-w-lg mx-auto mt-14">
      <div className="space-y-6">
        {STEPS.map((step, index) => {
          const completed = index < currentStep;

          return (
            <motion.div
              key={step}
              initial={{ opacity: 0.35 }}
              animate={{
                opacity: completed ? 1 : 0.35,
                y: completed ? 0 : 2,
              }}
              transition={{
                duration: 0.45,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="flex items-center gap-4"
            >
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-full transition-all duration-500 ${
                  completed
                    ? "bg-brand-ink text-brand-canvas"
                    : "border border-brand-border"
                }`}
              >
                {completed && <Check size={15} />}
              </div>

              <span
                className={`text-base transition-colors duration-500 ${
                  completed
                    ? "text-brand-ink"
                    : "text-brand-muted"
                }`}
              >
                {step}
              </span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};