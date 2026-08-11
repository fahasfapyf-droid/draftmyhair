"use client";

import { useEffect, useState } from "react";
import {
  getHairstyles,
  HairStyle,
  HairstyleFilters,
} from "@/lib/api/hairstyles";

interface UseHairstylesResult {
  styles: HairStyle[];
  loading: boolean;
  error: Error | null;
}

function matchesFilters(style: HairStyle, filters: HairstyleFilters): boolean {
  if (filters.serviceType && style.serviceType !== filters.serviceType) {
    return false;
  }

  if (
    filters.gender &&
    style.gender !== filters.gender &&
    style.gender !== "UNISEX"
  ) {
    return false;
  }

  if (filters.category && style.category !== filters.category) {
    return false;
  }

  return true;
}

export function useHairstyles(filters: HairstyleFilters = {}): UseHairstylesResult {
  const { gender, serviceType, category } = filters;
  const [styles, setStyles] = useState<HairStyle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadHairstyles() {
      setLoading(true);
      setError(null);

      try {
        const data = await getHairstyles({ gender, serviceType, category });

        if (!cancelled) {
          // Defense-in-depth: never render a style that does not match the
          // active catalog filters, even if an upstream/API cache returns
          // broader data than requested.
          setStyles(
            data
              .filter((style) => matchesFilters(style, { gender, serviceType, category }))
              .sort((a, b) => a.displayOrder - b.displayOrder),
          );
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error("Unknown error"));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadHairstyles();

    return () => {
      cancelled = true;
    };
  }, [gender, serviceType, category]);

  return {
    styles,
    loading,
    error,
  };
}
