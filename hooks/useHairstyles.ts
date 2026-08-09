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
  const { gender, serviceType } = filters;
  const [styles, setStyles] = useState<HairStyle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function loadHairstyles() {
      try {
        const data = await getHairstyles({ gender, serviceType });
        setStyles(data);
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Unknown error"));
      } finally {
        setLoading(false);
      }
    }

    loadHairstyles();
  }, [gender, serviceType]);

  return {
    styles,
    loading,
    error,
  };
}
