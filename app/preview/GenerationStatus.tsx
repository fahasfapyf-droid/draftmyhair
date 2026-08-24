"use client";

import React, { useEffect, useState } from "react";
import { Check, Loader2, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";
import type { PolledGenerationStatus } from "@/hooks/useGenerationPolling";

export type GenerationStatusState =
  | "idle"
  | "generating"
  | "success"
  | "failed";

interface GenerationStatusProps {
  status: GenerationStatusState;
  error?: string | null;
  polledStatus?: PolledGenerationStatus | null;
  onRetry?: () => void;
}

const STEPS = [
  "Preserving your facial identity",
  "Matching your natural hair color",
  "Adapting to your natural lighting",
  "Blending every strand naturally",
  "Performing a final quality check",
];

const STEP_DURATION = 800;
const RATE_LIMIT_ERROR_PREFIX = "[RATE_LIMIT_429]";
const RATE_LIMIT_USER_MESSAGE =
  "We're experiencing a temporary system issue. Your credit has been returned. Please try again in a few minutes.";

function getDisplayError(error?: string | null) {
  if (error?.includes(RATE_LIMIT_ERROR_PREFIX)) {
    return RATE_LIMIT_USER_MESSAGE;
  }

  return (
    error ??
    "Something went wrong while generating your hairstyle preview."
  );
}

export const GenerationStatus: React.FC<
  GenerationStatusProps
> = ({ status, error, polledStatus, onRetry }) => {
  const [currentStep, setCurrentStep] = useState(
    status === "generating" ? 0 : -1
  );

  useEffect(() => {
    if (status !== "generating") {
      return;
    }

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

  const displayedStep =
    status === "idle" ? -1 : currentStep;
  const processingMessage =
    polledStatus === "QUEUED"
      ? "Queued..."
      : polledStatus === "PROCESSING" && currentStep === STEPS.length - 1
      ? "Almost finished..."
      : polledStatus === "PROCESSING"
      ? "Generating preview..."
      : polledStatus === "COMPLETED"
      ? "Completed"
      : "Preparing generation...";

  return (
    <div className="w-full max-w-lg mx-auto mt-14">
      <div className="space-y-6">
        {STEPS.map((step, index) => {
          const completed =
            status === "success" ||
            (status === "generating" &&
              index < displayedStep);

          const active =
            status === "generating" &&
            index === displayedStep;

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

      {status === "generating" && (
        <p className="mt-8 text-center text-sm font-medium text-brand-muted" aria-live="polite">
          {processingMessage}
        </p>
      )}

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
                {getDisplayError(error)}
              </p>

              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="mt-4 rounded-editorial border border-red-300 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100"
                >
                  Try Again
                </button>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};
