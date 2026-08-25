const STORAGE_KEY = "draftmyhair:active-generation";

type ActiveGeneration = {
  generationId: string;
  startedAt: string;
};

export function getActiveGeneration(): ActiveGeneration | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<ActiveGeneration>;
    if (
      typeof parsed.generationId !== "string" ||
      typeof parsed.startedAt !== "string"
    ) {
      window.sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }

    return {
      generationId: parsed.generationId,
      startedAt: parsed.startedAt,
    };
  } catch {
    return null;
  }
}

export function setActiveGeneration(generationId: string, startedAt = new Date().toISOString()) {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ generationId, startedAt })
    );
  } catch {
    // Storage is a durability aid, not a reason to fail generation.
  }
}

export function clearActiveGeneration(generationId?: string) {
  if (typeof window === "undefined") return;

  try {
    if (generationId) {
      const active = getActiveGeneration();
      if (active && active.generationId !== generationId) return;
    }
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage cleanup failures.
  }
}
