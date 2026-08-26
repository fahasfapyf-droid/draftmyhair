"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { GenerationStatus } from "./GenerationStatus";
import { useGenerationSession } from "@/lib/context/GenerationSession";
import { useGenerationPolling } from "@/hooks/useGenerationPolling";
import { prepareGenerationImage } from "@/lib/image/prepare-generation-image";
import {
  clearActiveGeneration,
  getActiveGeneration,
  setActiveGeneration,
} from "@/lib/generation/active-generation-storage";

const MAX_ACTIVE_GENERATION_AGE_MS = 60 * 60 * 1000;

export default function PreviewContent() {
  const router = useRouter();
  const hasStartedGeneration = useRef(false);
  const [attempt, setAttempt] = useState(0);
  const [generationId, setGenerationId] = useState<string | null>(null);
  const { session, setGenerationStatus, setGenerationFailed } = useGenerationSession();

  const handleCompleted = useCallback((completedGenerationId: string) => {
    clearActiveGeneration(completedGenerationId);
    setGenerationStatus("success");
    console.info("[GENERATION_RECOVERY] generation completed", {
      generationId: completedGenerationId,
      at: new Date().toISOString(),
    });
    router.push(`/result?generationId=${completedGenerationId}`);
  }, [router, setGenerationStatus]);

  const handleFailed = useCallback((error: string) => {
    const active = getActiveGeneration();
    if (active) {
      clearActiveGeneration(active.generationId);
      console.info("[GENERATION_RECOVERY] generation terminated", {
        generationId: active.generationId,
        at: new Date().toISOString(),
      });
    }
    hasStartedGeneration.current = false;
    setGenerationId(null);
    setGenerationFailed(error);
  }, [setGenerationFailed]);

  const polledStatus = useGenerationPolling({
    generationId,
    onCompleted: handleCompleted,
    onFailed: handleFailed,
  });

  useEffect(() => {
    if (hasStartedGeneration.current) return;

    // The generation ID in the URL is the durable recovery reference. This
    // survives a full browser refresh even when the in-memory session is gone.
    const urlGenerationId =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("generationId")
        : null;

    if (urlGenerationId) {
      hasStartedGeneration.current = true;
      setActiveGeneration(urlGenerationId);
      setGenerationId(urlGenerationId);
      setGenerationStatus("generating");
      console.info("[GENERATION_RECOVERY] restored generation from URL", {
        generationId: urlGenerationId,
        at: new Date().toISOString(),
      });
      return;
    }

    // Keep sessionStorage as a secondary recovery path for previews that were
    // already running before the URL-based recovery reference was introduced.
    const activeGeneration = getActiveGeneration();
    if (activeGeneration) {
      const ageMs = Date.now() - Date.parse(activeGeneration.startedAt);
      if (Number.isFinite(ageMs) && ageMs >= 0 && ageMs <= MAX_ACTIVE_GENERATION_AGE_MS) {
        hasStartedGeneration.current = true;
        setGenerationId(activeGeneration.generationId);
        setGenerationStatus("generating");
        console.info("[GENERATION_RECOVERY] restored active generation", {
          generationId: activeGeneration.generationId,
          ageMs,
          at: new Date().toISOString(),
        });
        return;
      }

      clearActiveGeneration(activeGeneration.generationId);
    }

    if (!session.uploadedFile) {
      router.replace("/upload");
      return;
    }
    if (!session.selectedStyle) {
      router.replace("/style-selection");
      return;
    }

    hasStartedGeneration.current = true;
    const uploadedFile = session.uploadedFile;
    const selectedStyle = session.selectedStyle;
    const salonClientId = session.salonClientId;
    const nextGenerationId = crypto.randomUUID();

    // Put the generation ID into the URL before starting the provider request.
    // A refresh at any point during Vertex processing can now recover by ID.
    router.replace(`/preview?generationId=${nextGenerationId}`);
    setActiveGeneration(nextGenerationId);
    setGenerationId(nextGenerationId);

    async function generate() {
      const clientStartedAt = performance.now();
      const wallClockStartedAt = new Date().toISOString();
      setGenerationStatus("generating");

      console.info("[GENERATION_TIMING] client generation start", {
        generationId: nextGenerationId,
        style: selectedStyle.name,
        at: wallClockStartedAt,
      });

      try {
        const preparationStartedAt = performance.now();
        const generationImage = await prepareGenerationImage(uploadedFile);
        const preparationMs = Math.round(performance.now() - preparationStartedAt);

        console.info("[GENERATION_TIMING] upload prepared", {
          generationId: nextGenerationId,
          inputBytes: uploadedFile.size,
          preparedBytes: generationImage.size,
          preparationMs,
          at: new Date().toISOString(),
        });

        const formData = new FormData();
        formData.append("image", generationImage);
        formData.append("promptKey", selectedStyle.promptKey);
        formData.append("generationId", nextGenerationId);
        if (salonClientId) formData.append("salonClientId", salonClientId);

        const requestStartedAt = performance.now();
        console.info("[GENERATION_TIMING] generate request sent", {
          generationId: nextGenerationId,
          at: new Date().toISOString(),
        });

        const response = await fetch("/api/generate", { method: "POST", body: formData });
        const responseReceivedMs = Math.round(performance.now() - requestStartedAt);
        const result = await response.json().catch(() => null);
        const totalClientMs = Math.round(performance.now() - clientStartedAt);

        console.info("[GENERATION_TIMING] client received result", {
          generationId: nextGenerationId,
          httpStatus: response.status,
          responseReceivedMs,
          totalClientMs,
          at: new Date().toISOString(),
        });

        if (!response.ok || !result?.success) {
          throw new Error(result?.error ?? "Generation failed. Please try again.");
        }

        if (result.generationId !== nextGenerationId) {
          throw new Error("Generation identifier mismatch.");
        }
      } catch (error) {
        handleFailed(error instanceof Error ? error.message : "Unexpected error.");
      }
    }

    generate();
  }, [router, session.uploadedFile, session.selectedStyle, session.salonClientId, setGenerationStatus, handleFailed, attempt]);

  const retryGeneration = () => {
    if (session.generationStatus === "generating") return;
    setAttempt((value) => value + 1);
  };

  return (
    <main className="min-h-screen bg-brand-canvas flex items-center justify-center px-6">
      <div className="w-full max-w-2xl text-center">
        <p className="text-sm uppercase tracking-[0.25em] text-brand-muted mb-4">Draft My Hair</p>
        <h1 className="text-5xl font-semibold tracking-tight text-brand-ink mb-6">Creating your preview</h1>
        <p className="text-lg text-brand-muted max-w-xl mx-auto leading-relaxed">
          Creating a <strong>{session.selectedStyle?.name ?? "selected"}</strong> hairstyle preview.<br />
          Only your hairstyle is changing.<br />
          Your face, identity, lighting and expression remain exactly the same.
        </p>
        <GenerationStatus status={session.generationStatus} error={session.generationError} polledStatus={polledStatus} onRetry={retryGeneration} />
      </div>
    </main>
  );
}
