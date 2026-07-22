"use client";

import React, { useEffect, useState } from "react";
import { Check, Loader2, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";

export type GenerationStatusState =
  | "idle"
  | "generating"
  | "success"
  | "failed";

interface GenerationStatusProps {
  status: GenerationStatusState;
  error?: string | null;
}

const STEPS = [
  "Preserving your facial identity",
  "Matching your natural hair color",
  "Adapting to your natural lighting",
  "Blending every strand naturally",
  "Performing a final quality check",
];

const STEP_DURATION = 800;

export const GenerationStatus: React.FC<
  GenerationStatusProps
> = ({ status, error }) => {
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    if (status === "idle") {
      setCurrentStep(0);
      return;
    }

    if (status !== "generating") {
      return;
    }

    setCurrentStep(0);

    let step = 0;

    const timer = setInterval(() => {
      step++;

      if (step >= STEPS.length - 1) {
        setCurrentStep(STEPS.length - 1);
        clearInterval(timer);
      } else {
        setCurrentStep(step);
      }
    }, STEP_DURATION);

    return () => clearInterval(timer);
  }, [status]);

  return (
    <div className="w-full max-w-lg mx-auto mt-14">
      <div className="space-y-6">
        {STEPS.map((step, index) => {
          const completed =
            status === "success" ||
            (status === "generating" &&
              index < currentStep);

          const active =
            status === "generating" &&
            index === currentStep;

          return (
            <motion.div
              key={step}
              initial={{ opacity: 0.35 }}
              animate={{
                opacity:
                  completed || active ? 1 : 0.35,
              }}
              transition={{
                duration: 0.35,
              }}
              className="flex items-center gap-4"
            >
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-full transition-all duration-300 ${
                  completed
                    ? "bg-brand-ink text-brand-canvas"
                    : active
                    ? "border border-brand-ink"
                    : "border border-brand-border"
                }`}
              >
                {completed ? (
                  <Check size={15} />
                ) : active ? (
                  <Loader2
                    size={15}
                    className="animate-spin"
                  />
                ) : null}
              </div>

              <span
                className={`text-base ${
                  completed || active
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

      {status === "failed" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-8 rounded-xl border border-red-200 bg-red-50 p-4"
        >
          <div className="flex items-start gap-3">
            <AlertCircle
              className="mt-0.5 text-red-600"
              size={18}
            />

            <div>
              <p className="font-medium text-red-700">
                Generation failed
              </p>

              <p className="mt-1 text-sm text-red-600">
                {error ??
                  "Something went wrong while generating your hairstyle preview."}
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};