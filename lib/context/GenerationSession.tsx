"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  ReactNode,
} from "react";

export interface SelectedHairstyle {
  id: string;
  name: string;
  promptKey: string;
}

export type GenerationStatus =
  | "idle"
  | "generating"
  | "success"
  | "failed";

export interface GenerationSessionData {
  uploadedFile: File | null;
  uploadedPreview: string | null;
  selectedStyle: SelectedHairstyle | null;

  generatedImageUrl: string | null;
  generationId: string | null;
  generationStatus: GenerationStatus;
  generationError: string | null;
}

interface GenerationSessionContextType {
  session: GenerationSessionData;

  setUploadedPhoto: (
    file: File | null,
    preview: string | null
  ) => void;

  setSelectedStyle: (
    style: SelectedHairstyle | null
  ) => void;

  setGenerationStatus: (
    status: GenerationStatus
  ) => void;

  setGenerationResult: (
    imageUrl: string,
    generationId: string
  ) => void;

  setGenerationFailed: (
    error: string
  ) => void;

  clearGenerationResult: () => void;

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
    useState<SelectedHairstyle | null>(null);

  const [generatedImageUrl, setGeneratedImageUrl] =
    useState<string | null>(null);

  const [generationId, setGenerationId] =
    useState<string | null>(null);

  const [generationStatus, setGenerationStatusState] =
    useState<GenerationStatus>("idle");

  const [generationError, setGenerationError] =
    useState<string | null>(null);

  function setUploadedPhoto(
    file: File | null,
    preview: string | null
  ) {
    setUploadedFile(file);
    setUploadedPreview(preview);
  }

  function setSelectedStyle(
    style: SelectedHairstyle | null
  ) {
    setSelectedStyleState(style);
  }

  function setGenerationStatus(
    status: GenerationStatus
  ) {
    setGenerationStatusState(status);
  }

  function setGenerationResult(
    imageUrl: string,
    id: string
  ) {
    setGeneratedImageUrl(imageUrl);
    setGenerationId(id);
    setGenerationStatusState("success");
    setGenerationError(null);
  }

  function setGenerationFailed(
    error: string
  ) {
    setGenerationStatusState("failed");
    setGenerationError(error);
  }

  function clearGenerationResult() {
    setGeneratedImageUrl(null);
    setGenerationId(null);
    setGenerationStatusState("idle");
    setGenerationError(null);
  }

  function resetSession() {
    setUploadedFile(null);
    setUploadedPreview(null);
    setSelectedStyleState(null);

    clearGenerationResult();
  }

  const value = useMemo(
    () => ({
      session: {
        uploadedFile,
        uploadedPreview,
        selectedStyle,

        generatedImageUrl,
        generationId,
        generationStatus,
        generationError,
      },

      setUploadedPhoto,
      setSelectedStyle,

      setGenerationStatus,
      setGenerationResult,
      setGenerationFailed,
      clearGenerationResult,

      resetSession,
    }),
    [
      uploadedFile,
      uploadedPreview,
      selectedStyle,

      generatedImageUrl,
      generationId,
      generationStatus,
      generationError,
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