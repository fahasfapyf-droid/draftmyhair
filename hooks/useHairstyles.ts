"use client";

import { useEffect, useState } from "react";
import { getHairstyles, HairStyle } from "@/lib/api/hairstyles";

interface UseHairstylesResult {
  styles: HairStyle[];
  loading: boolean;
  error: Error | null;
}

export function useHairstyles(): UseHairstylesResult {
  const [styles, setStyles] = useState<HairStyle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function loadHairstyles() {
      try {
        const data = await getHairstyles();
        setStyles(data);
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Unknown error"));
      } finally {
        setLoading(false);
      }
    }

    loadHairstyles();
  }, []);

  return {
    styles,
    loading,
    error,
  };
}