"use client";

import React, {
  createContext,
  useContext,
  useMemo,
  useState,
} from "react";

interface GenerationSessionValue {
  selectedFile: File | null;
  selectedStyleId: string | null;
  generatedImageUrl: string | null;
  jobId: string | null;

  setSelectedFile: (file: File | null) => void;
  setSelectedStyleId: (styleId: string | null) => void;
  setGeneratedImageUrl: (url: string | null) => void;
  setJobId: (jobId: string | null) => void;

  reset: () => void;
}

const GenerationSessionContext =
  createContext<GenerationSessionValue | undefined>(undefined);

export function GenerationSessionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [selectedFile, setSelectedFile] =
    useState<File | null>(null);

  const [selectedStyleId, setSelectedStyleId] =
    useState<string | null>(null);

  const [generatedImageUrl, setGeneratedImageUrl] =
    useState<string | null>(null);

  const [jobId, setJobId] =
    useState<string | null>(null);

  const reset = () => {
    setSelectedFile(null);
    setSelectedStyleId(null);
    setGeneratedImageUrl(null);
    setJobId(null);
  };

  const value = useMemo(
    () => ({
      selectedFile,
      selectedStyleId,
      generatedImageUrl,
      jobId,

      setSelectedFile,
      setSelectedStyleId,
      setGeneratedImageUrl,
      setJobId,

      reset,
    }),
    [
      selectedFile,
      selectedStyleId,
      generatedImageUrl,
      jobId,
    ]
  );

  return (
    <GenerationSessionContext.Provider value={value}>
      {children}
    </GenerationSessionContext.Provider>
  );
}

export function useGenerationSession() {
  const context = useContext(GenerationSessionContext);

  if (!context) {
    throw new Error(
      "useGenerationSession must be used inside GenerationSessionProvider."
    );
  }

  return context;
}