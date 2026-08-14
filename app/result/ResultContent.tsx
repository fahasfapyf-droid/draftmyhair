"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Download, RefreshCcw, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FeedbackForm } from "./FeedbackForm";

export interface ResultGeneration {
  id: string;
  imageUrl: string;
  hairstyle: { id: string; name: string };
}

interface ResultContentProps { generation: ResultGeneration; }

export default function ResultContent({ generation }: ResultContentProps) {
  const formattedStyle = generation.hairstyle.name;

  return (
    <main className="min-h-screen bg-brand-canvas px-6 py-20">
      <div className="mx-auto max-w-6xl">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="mb-12 text-center">
          <p className="mb-4 text-sm uppercase tracking-[0.25em] text-brand-muted">Draft My Hair</p>
          <h1 className="mb-5 text-5xl font-semibold tracking-tight text-brand-ink md:text-6xl">Your Preview is Ready</h1>
          <p className="mx-auto max-w-2xl text-lg leading-relaxed text-brand-muted">Here&apos;s how <strong>{formattedStyle}</strong> could look on you.</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8, delay: 0.25, ease: [0.16, 1, 0.3, 1] }} className="mx-auto max-w-2xl overflow-hidden rounded-editorial border border-brand-border bg-brand-surface shadow-editorial">
          <div className="aspect-[3/4] bg-brand-border/15">
            <img src={generation.imageUrl} alt={formattedStyle} className="h-full w-full object-cover" />
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, delay: 1.1 }} className="mt-12 flex justify-center">
          <Button asChild variant="primary" size="lg" className="min-w-[280px]">
            <a href={generation.imageUrl} download target="_blank" rel="noopener noreferrer">
              <Download className="mr-2 h-5 w-5" />
              Download Image
            </a>
          </Button>
        </motion.div>

        <FeedbackForm generationId={generation.id} hairstyleId={generation.hairstyle.id} />

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, delay: 1.35 }} className="mt-10 flex flex-col justify-center gap-8 sm:flex-row">
          <Link href="/style-selection" className="inline-flex items-center justify-center text-brand-muted transition-colors duration-300 hover:text-brand-ink">
            <RefreshCcw className="mr-2 h-4 w-4" />
            Try Another Hairstyle
          </Link>
          <Link href="/upload" className="inline-flex items-center justify-center text-brand-muted transition-colors duration-300 hover:text-brand-ink">
            <Upload className="mr-2 h-4 w-4" />
            Upload New Photo
          </Link>
        </motion.div>
      </div>
    </main>
  );
}
