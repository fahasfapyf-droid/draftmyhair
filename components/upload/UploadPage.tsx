// components/upload/UploadPage.tsx
"use client";

import React, { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Container } from "@/components/ui/container";
import { UploadDropzone } from "./UploadDropzone";
import { UploadPreview } from "./UploadPreview";
import { PrivacyRow } from "./PrivacyRow";
import { PhotoRequirements } from "./PhotoRequirements";

export const UploadPage: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Clean up object URL to avoid memory leaks
  useEffect(() => {
  if (!previewUrl) return;

  return () => {
    URL.revokeObjectURL(previewUrl);
  };
}, [previewUrl]);

  const handleFileSelect = (file: File) => {
  if (previewUrl) {
    URL.revokeObjectURL(previewUrl);
  }

  setSelectedFile(file);
  setPreviewUrl(URL.createObjectURL(file));
};

  const handleReplace = () => {
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.15, delayChildren: 0.1 },
    },
  };

  const fadeUpVariants = {
    hidden: { opacity: 0, y: 16 },
    visible: { 
      opacity: 1, 
      y: 0, 
      transition: { duration: 1, ease: [0.16, 1, 0.3, 1] } 
    },
  };

  return (
    <motion.div 
      className="w-full max-w-4xl mx-auto flex flex-col items-center py-24 md:py-32"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <Container>
        <div className="flex flex-col items-center w-full">
          <motion.div variants={fadeUpVariants} className="max-w-2xl mx-auto text-center mb-12 md:mb-16">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-semibold tracking-editorial leading-[1.05] text-brand-ink mb-6 text-balance">
              Upload Your Photo
            </h1>
            <p className="text-lg md:text-xl text-brand-muted leading-relaxed max-w-lg mx-auto tracking-tight">
              Only your hair changes. Your identity, skin, expression, and facial structure remain exactly the same.
            </p>
          </motion.div>

          <motion.div variants={fadeUpVariants} className="w-full">
            <AnimatePresence mode="wait">
  {previewUrl ? (
    <motion.div
      key="preview"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 16 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      <UploadPreview
        imageUrl={previewUrl}
        onReplace={handleReplace}
      />
    </motion.div>
  ) : (
    <motion.div
      key="dropzone"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 16 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      <UploadDropzone
        onFileSelect={handleFileSelect}
      />
    </motion.div>
  )}
</AnimatePresence>
          </motion.div>

          {!previewUrl && (
  <motion.div
    variants={fadeUpVariants}
    className="w-full mt-6 mb-16"
  >
    <PrivacyRow />
  </motion.div>
)}

          {!previewUrl && (
  <motion.div
    variants={fadeUpVariants}
    className="w-full"
  >
    <PhotoRequirements />
  </motion.div>
)}

          
        </div>
      </Container>
    </motion.div>
  );
};