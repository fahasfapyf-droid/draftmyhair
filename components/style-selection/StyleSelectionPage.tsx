"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

import { Container } from "@/components/ui/container";
import { CollectionHeader } from "./CollectionHeader";
import { CatalogNavigator } from "./CatalogNavigator";
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

function getGenderFilter(value: string | null): HairstyleGender {
  if (value === "MALE" || value === "UNISEX") return value;
  return "FEMALE";
}

type StyleSelectionPageProps = {
  category?: string;
  gender?: string;
  styleCategory?: string;
};

export const StyleSelectionPage: React.FC<StyleSelectionPageProps> = ({
  category,
  gender: requestedGender,
  styleCategory,
}) => {
  const router = useRouter();
  const { setSelectedStyle, clearGenerationResult } = useGenerationSession();

  const serviceType = SERVICE_TYPE_BY_CATEGORY[category ?? "hairstyle"] ?? "HAIRSTYLE";
  const gender = getGenderFilter(requestedGender ?? null);
  const categoryFilter = serviceType === "HAIRSTYLE" ? styleCategory : undefined;
  const { styles, loading, error } = useHairstyles({
    serviceType,
    gender,
    category: categoryFilter,
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleContinue = () => {
    const selectedStyle = styles.find((style) => style.id === selectedId);

    if (!selectedStyle?.promptKey) return;

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
          <CollectionHeader
            gender={gender}
            serviceType={serviceType}
            styleCategory={categoryFilter}
          />

          <CatalogNavigator
            gender={gender}
            serviceType={serviceType}
            styleCategory={categoryFilter}
          />

          {loading && (
            <p className="py-20 text-center text-brand-muted">
              Loading available looks...
            </p>
          )}

          {error && (
            <p className="py-20 text-center text-red-500" role="alert">
              Failed to load the catalog. Please try again shortly.
            </p>
          )}

          {!loading && !error && styles.length === 0 && (
            <div className="py-20 text-center">
              <p className="text-brand-ink font-medium">No production looks are available here yet.</p>
              <p className="mt-2 text-sm text-brand-muted">
                This category is ready for production engines as they are finalized.
              </p>
            </div>
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
        disabled={!styles.find((style) => style.id === selectedId)?.promptKey}
        onContinue={handleContinue}
      />
    </main>
  );
};
