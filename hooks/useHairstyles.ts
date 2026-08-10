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
          setStyles(data);
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
