"use client";
import { useGenerationSession } from "@/lib/context/GenerationSession";


import React, { useState } from "react";
import { useRouter } from "next/navigation";

import { Container } from "@/components/ui/container";
import { CollectionHeader } from "./CollectionHeader";
import { StyleGrid } from "./StyleGrid";
import { StickyContinue } from "./StickyContinue";
import { useHairstyles } from "@/hooks/useHairstyles";

export const StyleSelectionPage: React.FC = () => {
  const router = useRouter();
  const { setSelectedStyle } = useGenerationSession();

  const { styles, loading, error } = useHairstyles();

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleContinue = () => {
  if (!selectedId) return;

  setSelectedStyle(selectedId);

  router.push("/preview");
};

  return (
    <main className="min-h-screen bg-brand-canvas pt-24 md:pt-32 relative flex flex-col w-full">
      <Container>
        <div className="max-w-6xl mx-auto w-full">
          <CollectionHeader />

          {loading && (
            <p className="py-20 text-center text-brand-muted">
              Loading hairstyles...
            </p>
          )}

          {error && (
            <p className="py-20 text-center text-red-500" role="alert">
              Failed to load hairstyles.
            </p>
          )}

          {!loading && !error && styles.length === 0 && (
            <p className="py-20 text-center text-brand-muted" role="status">
              No hairstyles are available right now. Please try again shortly.
            </p>
          )}

          {!loading && !error && styles.length > 0 && (
            <StyleGrid
              styles={styles}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          )}
        </div>
      </Container>

      <StickyContinue
        disabled={!selectedId}
        onContinue={handleContinue}
      />
    </main>
  );
};
