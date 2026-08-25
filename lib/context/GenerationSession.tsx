"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from "react";

export interface SelectedHairstyle {
  id: string;
  name: string;
  promptKey: string;
}

export type GenerationStatus = "idle" | "generating" | "success" | "failed";

export interface GenerationSessionData {
  uploadedFile: File | null;
  uploadedPreview: string | null;
  selectedStyle: SelectedHairstyle | null;
  salonClientId: string | null;
  generationStatus: GenerationStatus;
  generationError: string | null;
}

interface GenerationSessionContextType {
  session: GenerationSessionData;
  setUploadedPhoto: (file: File | null, preview: string | null) => void;
  setSelectedStyle: (style: SelectedHairstyle | null) => void;
  setSalonClientId: (clientId: string | null) => void;
  setGenerationStatus: (status: GenerationStatus) => void;
  setGenerationFailed: (error: string) => void;
  clearGenerationResult: () => void;
  resetSession: () => void;
}

const GenerationSessionContext = createContext<GenerationSessionContextType | null>(null);

export function GenerationSessionProvider({ children }: { children: ReactNode }) {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadedPreview, setUploadedPreview] = useState<string | null>(null);
  const [selectedStyle, setSelectedStyleState] = useState<SelectedHairstyle | null>(null);
  const [salonClientId, setSalonClientIdState] = useState<string | null>(null);
  const [generationStatus, setGenerationStatusState] = useState<GenerationStatus>("idle");
  const [generationError, setGenerationError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (uploadedPreview?.startsWith("blob:")) URL.revokeObjectURL(uploadedPreview);
    };
  }, [uploadedPreview]);

  const setUploadedPhoto = useCallback((file: File | null, preview: string | null) => {
    setUploadedFile(file);
    setUploadedPreview(preview);
  }, []);

  const setSelectedStyle = useCallback((style: SelectedHairstyle | null) => {
    setSelectedStyleState(style);
  }, []);

  const setSalonClientId = useCallback((clientId: string | null) => {
    setSalonClientIdState(clientId);
  }, []);

  const setGenerationStatus = useCallback((status: GenerationStatus) => {
    setGenerationStatusState(status);
  }, []);

  const setGenerationFailed = useCallback((error: string) => {
    setGenerationStatusState("failed");
    setGenerationError(error);
  }, []);

  const clearGenerationResult = useCallback(() => {
    setGenerationStatusState("idle");
    setGenerationError(null);
  }, []);

  const resetSession = useCallback(() => {
    setUploadedFile(null);
    setUploadedPreview(null);
    setSelectedStyleState(null);
    setSalonClientIdState(null);
    clearGenerationResult();
  }, [clearGenerationResult]);

  const value = useMemo(() => ({
    session: { uploadedFile, uploadedPreview, selectedStyle, salonClientId, generationStatus, generationError },
    setUploadedPhoto,
    setSelectedStyle,
    setSalonClientId,
    setGenerationStatus,
    setGenerationFailed,
    clearGenerationResult,
    resetSession,
  }), [uploadedFile, uploadedPreview, selectedStyle, salonClientId, generationStatus, generationError, setUploadedPhoto, setSelectedStyle, setSalonClientId, setGenerationStatus, setGenerationFailed, clearGenerationResult, resetSession]);

  return <GenerationSessionContext.Provider value={value}>{children}</GenerationSessionContext.Provider>;
}

export function useGenerationSession() {
  const context = useContext(GenerationSessionContext);
  if (!context) throw new Error("useGenerationSession must be used inside GenerationSessionProvider");
  return context;
}
