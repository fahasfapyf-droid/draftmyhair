"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

import { Container } from "@/components/ui/container";
import { CollectionHeader } from "./CollectionHeader";
import { StyleGrid } from "./StyleGrid";
import { StickyContinue } from "./StickyContinue";

import { useHairstyles } from "@/hooks/useHairstyles";
import {
  HairstyleGender,
  HairstyleServiceType,
} from "@/lib/api/hairstyles";
import { useGenerationSession } from "@/lib/context/GenerationSession";

const SERVICE_TYPE_BY_CATEGORY: Record<string, HairstyleServiceType> = {
  hairstyle: "HAIRSTYLE",
  "hair-colour": "HAIR_COLOR",
  "buzz-cut": "BUZZ_CUT",
  bald: "BALD",
  "beard-style": "BEARD",
  "beard-removal": "BEARD_REMOVAL",
};

function getGenderFilter(value: string | null): HairstyleGender | undefined {
  if (value === "FEMALE" || value === "MALE" || value === "UNISEX") {
    return value;
  }
}

type StyleSelectionPageProps = {
  category?: string;
  gender?: string;
};

export const StyleSelectionPage: React.FC<StyleSelectionPageProps> = ({
  category,
  gender: requestedGender,
}) => {
  const router = useRouter();

  const {
    setSelectedStyle,
    clearGenerationResult,
  } = useGenerationSession();

  const serviceType = SERVICE_TYPE_BY_CATEGORY[category ?? "hairstyle"];
  const gender = getGenderFilter(requestedGender ?? null);
  const { styles, loading, error } = useHairstyles({ serviceType, gender });

  const [selectedId, setSelectedId] =
    useState<string | null>(null);

  const handleContinue = () => {
    const selectedStyle = styles.find(
      (style) => style.id === selectedId
    );

    if (!selectedStyle?.promptKey) {
      return;
    }

    // A different hairstyle always requires
    // a fresh generation.
    clearGenerationResult();

    setSelectedStyle({
      id: selectedStyle.id,
      name: selectedStyle.name,
      promptKey: selectedStyle.promptKey,
    });

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
            <p
              className="py-20 text-center text-red-500"
              role="alert"
            >
              Failed to load hairstyles.
            </p>
          )}

          {!loading &&
            !error &&
            styles.length === 0 && (
              <p
                className="py-20 text-center text-brand-muted"
                role="status"
              >
                No hairstyles are available right now.
                Please try again shortly.
              </p>
            )}

          {!loading &&
            !error &&
            styles.length > 0 && (
              <StyleGrid
                styles={styles}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
            )}
        </div>
      </Container>

      <StickyContinue
        disabled={
          !styles.find(
            (style) => style.id === selectedId
          )?.promptKey
        }
        onContinue={handleContinue}
      />
    </main>
  );
};
