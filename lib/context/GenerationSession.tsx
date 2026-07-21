"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  ReactNode,
} from "react";

export interface GenerationSessionData {
  uploadedFile: File | null;
  uploadedPreview: string | null;
  selectedStyle: string | null;
}

interface GenerationSessionContextType {
  session: GenerationSessionData;

  setUploadedPhoto: (
    file: File | null,
    preview: string | null
  ) => void;

  setSelectedStyle: (
    style: string | null
  ) => void;

  resetSession: () => void;
}

const GenerationSessionContext =
  createContext<GenerationSessionContextType | null>(null);

export function GenerationSessionProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [uploadedFile, setUploadedFile] =
    useState<File | null>(null);

  const [uploadedPreview, setUploadedPreview] =
    useState<string | null>(null);

  const [selectedStyle, setSelectedStyleState] =
    useState<string | null>(null);

  function setUploadedPhoto(
    file: File | null,
    preview: string | null
  ) {
    setUploadedFile(file);
    setUploadedPreview(preview);
  }

  function setSelectedStyle(style: string | null) {
    setSelectedStyleState(style);
  }

  function resetSession() {
    setUploadedFile(null);
    setUploadedPreview(null);
    setSelectedStyleState(null);
  }

  const value = useMemo(
    () => ({
      session: {
        uploadedFile,
        uploadedPreview,
        selectedStyle,
      },
      setUploadedPhoto,
      setSelectedStyle,
      resetSession,
    }),
    [
      uploadedFile,
      uploadedPreview,
      selectedStyle,
    ]
  );

  return (
    <GenerationSessionContext.Provider value={value}>
      {children}
    </GenerationSessionContext.Provider>
  );
}

export function useGenerationSession() {
  const context = useContext(
    GenerationSessionContext
  );

  if (!context) {
    throw new Error(
      "useGenerationSession must be used inside GenerationSessionProvider"
    );
  }

  return context;
}