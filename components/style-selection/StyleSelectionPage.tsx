"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

import { Container } from "@/components/ui/container";
import { CollectionHeader } from "./CollectionHeader";
import { StyleGrid } from "./StyleGrid";
import { StickyContinue } from "./StickyContinue";
import { freshStartStyles } from "./data";

export const StyleSelectionPage: React.FC = () => {
  const router = useRouter();

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleContinue = () => {
    if (!selectedId) return;

    router.push(`/preview?style=${selectedId}`);
  };

  return (
    <main className="min-h-screen bg-brand-canvas pt-24 md:pt-32 relative flex flex-col w-full">
      <Container>
        <div className="max-w-6xl mx-auto w-full">
          <CollectionHeader />

          <StyleGrid
            styles={freshStartStyles}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </div>
      </Container>

      <StickyContinue
        disabled={!selectedId}
        onContinue={handleContinue}
      />
    </main>
  );
};