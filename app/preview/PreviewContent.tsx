"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { GenerationStatus } from "./GenerationStatus";
import { useGenerationSession } from "@/lib/context/GenerationSession";

export default function PreviewContent() {
  const router = useRouter();

  const {
    session,
    setGenerationStatus,
    setGenerationResult,
    setGenerationFailed,
  } = useGenerationSession();

  useEffect(() => {
    async function generate() {
      if (
        !session.uploadedFile ||
        !session.selectedStyle ||
        session.generationStatus === "generating"
      ) {
        return;
      }

      setGenerationStatus("generating");

      try {
        const formData = new FormData();

        formData.append("image", session.uploadedFile);
        formData.append(
          "promptKey",
          session.selectedStyle.promptKey
        );

        const response = await fetch("/api/generate", {
          method: "POST",
          body: formData,
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(
            result.error ?? "Generation failed."
          );
        }

        setGenerationResult(
          result.imageUrl,
          result.generationId
        );

        router.push("/result");
      } catch (error) {
        setGenerationFailed(
          error instanceof Error
            ? error.message
            : "Unexpected error."
        );
      }
    }

    generate();
  }, [
    router,
    session.uploadedFile,
    session.selectedStyle,
    session.generationStatus,
    setGenerationStatus,
    setGenerationResult,
    setGenerationFailed,
  ]);

  return (
    <main className="min-h-screen bg-brand-canvas flex items-center justify-center px-6">
      <div className="w-full max-w-2xl text-center">
        <p className="text-sm uppercase tracking-[0.25em] text-brand-muted mb-4">
          Draft My Hair
        </p>

        <h1 className="text-5xl font-semibold tracking-tight text-brand-ink mb-6">
          Creating your preview
        </h1>

        <p className="text-lg text-brand-muted max-w-xl mx-auto leading-relaxed">
          Creating a{" "}
          <strong>{session.selectedStyle?.name ?? "selected"}</strong>{" "}
          hairstyle preview.
          <br />
          Only your hairstyle is changing.
          <br />
          Your face, identity, lighting and expression remain exactly the same.
        </p>

        <GenerationStatus
  status={session.generationStatus}
  error={session.generationError}
/>
      </div>
    </main>
  );
}