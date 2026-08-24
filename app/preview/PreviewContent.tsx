"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { GenerationStatus } from "./GenerationStatus";
import { useGenerationSession } from "@/lib/context/GenerationSession";
import { useGenerationPolling } from "@/hooks/useGenerationPolling";
import { prepareGenerationImage } from "@/lib/image/prepare-generation-image";

export default function PreviewContent() {
  const router = useRouter();
  const hasStartedGeneration = useRef(false);
  const [attempt, setAttempt] = useState(0);
  const [generationId, setGenerationId] = useState<string | null>(null);
  const { session, setGenerationStatus, setGenerationFailed } = useGenerationSession();

  const handleCompleted = useCallback((completedGenerationId: string) => {
    setGenerationStatus("success");
    console.info("[GENERATION_TIMING] result navigation", {
      generationId: completedGenerationId,
      at: new Date().toISOString(),
    });
    router.push(`/result?generationId=${completedGenerationId}`);
  }, [router, setGenerationStatus]);

  const handleFailed = useCallback((error: string) => {
    hasStartedGeneration.current = false;
    setGenerationId(null);
    setGenerationFailed(error);
  }, [setGenerationFailed]);

  const polledStatus = useGenerationPolling({ generationId, onCompleted: handleCompleted, onFailed: handleFailed });

  useEffect(() => {
    if (!session.uploadedFile) {
      router.replace("/upload");
      return;
    }
    if (!session.selectedStyle) {
      router.replace("/style-selection");
      return;
    }
    if (hasStartedGeneration.current) return;

    hasStartedGeneration.current = true;
    const uploadedFile = session.uploadedFile;
    const selectedStyle = session.selectedStyle;
    const salonClientId = session.salonClientId;
    const nextGenerationId = crypto.randomUUID();
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
