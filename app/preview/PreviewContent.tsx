"use client";

import { useRouter } from "next/navigation";

import { GenerationStatus } from "./GenerationStatus";
import { useGenerationSession } from "@/lib/context/GenerationSession";

export default function PreviewContent() {
  const router = useRouter();

  const { session } = useGenerationSession();

  const handleComplete = () => {
    router.push("/result");
  };

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
          <strong>{session.selectedStyle ?? "selected"}</strong>{" "}
          hairstyle preview.
          <br />
          Only your hairstyle is changing.
          <br />
          Your face, identity, lighting and expression remain exactly the same.
        </p>

        <GenerationStatus onComplete={handleComplete} />
      </div>
    </main>
  );
}