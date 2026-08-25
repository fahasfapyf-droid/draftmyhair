"use client";

import React, { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useSearchParams } from "next/navigation";

import { Container } from "@/components/ui/container";
import { UploadDropzone } from "./UploadDropzone";
import { UploadPreview } from "./UploadPreview";
import { PrivacyRow } from "./PrivacyRow";
import { PhotoRequirements } from "./PhotoRequirements";
import { useGenerationSession } from "@/lib/context/GenerationSession";

export const UploadPage: React.FC = () => {
  const searchParams = useSearchParams();
  const { session, setUploadedPhoto, setSalonClientId, clearGenerationResult } = useGenerationSession();
  const previewUrl = session.uploadedPreview;

  useEffect(() => {
    const clientId = searchParams.get("clientId");
    if (searchParams.get("source") === "salon" && clientId) setSalonClientId(clientId);
  }, [searchParams, setSalonClientId]);

  const handleFileSelect = (file: File) => {
    const objectUrl = URL.createObjectURL(file);
    clearGenerationResult();
    setUploadedPhoto(file, objectUrl);
  };

  const handleReplace = () => {
    clearGenerationResult();
    setUploadedPhoto(null, null);
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1, delayChildren: 0.05 },
    },
  };

  const fadeUpVariants = {
    hidden: { opacity: 0, y: 12 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] },
    },
  };

  return (
    <motion.div
      className="w-full max-w-5xl mx-auto flex flex-col items-center py-8 md:py-10 lg:min-h-[calc(100vh-4rem)] lg:justify-center lg:py-6"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <Container>
        <div className="flex flex-col items-center w-full">
          <motion.div
            variants={fadeUpVariants}
            className="max-w-2xl mx-auto text-center mb-6 md:mb-7"
          >
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-semibold tracking-editorial leading-[1.05] text-brand-ink mb-3 md:mb-4 text-balance">
              Upload Your Photo
            </h1>
            <p className="text-base md:text-lg text-brand-muted leading-relaxed max-w-xl mx-auto tracking-tight">
              Only your hair changes. Your identity, skin, expression, and facial structure remain exactly the same.
            </p>
            {session.salonClientId && (
              <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-muted">
                Salon client preview
              </p>
            )}
          </motion.div>

          <motion.div variants={fadeUpVariants} className="w-full">
            <AnimatePresence mode="wait">
              {previewUrl ? (
                <motion.div
                  key="preview"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 12 }}
                  transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                >
                  <UploadPreview imageUrl={previewUrl} onReplace={handleReplace} />
                </motion.div>
              ) : (
                <motion.div
                  key="dropzone"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 12 }}
                  transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                >
                  <UploadDropzone onFileSelect={handleFileSelect} />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {!previewUrl && (
            <motion.div variants={fadeUpVariants} className="w-full mt-3 mb-5">
              <PrivacyRow />
            </motion.div>
          )}

          {!previewUrl && (
            <motion.div variants={fadeUpVariants} className="w-full">
              <PhotoRequirements />
            </motion.div>
          )}
        </div>
      </Container>
    </motion.div>
  );
};
