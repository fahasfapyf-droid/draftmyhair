"use client";

import Link from "next/link";
import { useGenerationSession } from "@/lib/context/GenerationSession";
import { motion } from "framer-motion";
import { Download, RefreshCcw, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FeedbackForm } from "./FeedbackForm";

export default function ResultContent() {
  const { session } = useGenerationSession();

const formattedStyle = session.selectedStyle
  ? session.selectedStyle
      .split("-")
      .map(
        (word) => word.charAt(0).toUpperCase() + word.slice(1)
      )
      .join(" ")
  : "Your Hairstyle";

  return (
    <main className="min-h-screen bg-brand-canvas px-6 py-20">
      <div className="max-w-6xl mx-auto">

        {/* Heading */}

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <p className="text-sm uppercase tracking-[0.25em] text-brand-muted mb-4">
            Draft My Hair
          </p>

          <h1 className="text-5xl md:text-6xl font-semibold tracking-tight text-brand-ink mb-5">
            Your Preview is Ready
          </h1>

          <p className="text-lg text-brand-muted max-w-2xl mx-auto leading-relaxed">
            Here&apos;s how <strong>{formattedStyle}</strong> could look on you.
          </p>
        </motion.div>

        {/* Preview Image */}

        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{
            duration: 0.8,
            delay: 0.25,
            ease: [0.16, 1, 0.3, 1],
          }}
          className="max-w-2xl mx-auto rounded-editorial overflow-hidden border border-brand-border bg-brand-surface shadow-editorial"
        >
          <div className="aspect-[3/4] min-h-[720px] flex items-center justify-center bg-brand-border/15">

            {/* Placeholder until Gemini is connected */}

            <div className="text-center px-10">

              <h2 className="text-3xl font-semibold text-brand-ink mb-4">
                {formattedStyle}
              </h2>

              <p className="text-brand-muted leading-relaxed">
                Your generated hairstyle preview will appear here once the
                Draft My Hair Engine is connected.
              </p>

            </div>

          </div>
        </motion.div>

        {/* Download Button */}

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{
            duration: 0.5,
            delay: 1.1,
          }}
          className="mt-12 flex justify-center"
        >
          <Button
  variant="primary"
  size="lg"
  disabled
  className="min-w-[280px]"
>
  <Download className="mr-2 h-5 w-5" />
  Download Image (Coming Soon)
</Button>
        </motion.div>

        <FeedbackForm hairstyleId={session.selectedStyle} />

        {/* Secondary Actions */}

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{
            duration: 0.5,
            delay: 1.35,
          }}
          className="mt-10 flex flex-col sm:flex-row justify-center gap-8"
        >
          <Link
            href="/style-selection"
            className="inline-flex items-center justify-center text-brand-muted hover:text-brand-ink transition-colors duration-300"
          >
            <RefreshCcw className="mr-2 h-4 w-4" />
            Try Another Hairstyle
          </Link>

          <Link
            href="/upload"
            className="inline-flex items-center justify-center text-brand-muted hover:text-brand-ink transition-colors duration-300"
          >
            <Upload className="mr-2 h-4 w-4" />
            Upload New Photo
          </Link>
        </motion.div>

      </div>
    </main>
  );
}
