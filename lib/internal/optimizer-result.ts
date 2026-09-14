/**
 * ============================================================
 * Draft My Hair — Internal optimizer result access control
 * ============================================================
 *
 * Pure decision logic for
 *   GET /api/internal/optimizer/generations/{generationId}/result
 *
 * Kept free of next/prisma/@vercel/blob imports so it can be
 * unit-tested directly with node:test.
 *
 * Rules (all fail closed):
 *  - only the internal/system generation flow may be downloaded here
 *    (generation.userId === INTERNAL_SYSTEM_USER_ID);
 *  - a normal customer generation is indistinguishable from "not found"
 *    (404) — its existence is never revealed;
 *  - only COMPLETED generations with a stored result artifact stream;
 *  - everything else is rejected (503/404/409); there is never a
 *    redirect to /api/blob and never a public or signed URL.
 */

export type GenerationRowForResult = {
  userId: string;
  status: string;
  resultStorageKey: string | null;
};

export type ResultAccessDecision =
  | { ok: true }
  | { ok: false; status: number; error: string };

export function resolveOptimizerResultAccess(
  generation: GenerationRowForResult | null,
  systemUserId: string | undefined
): ResultAccessDecision {
  if (!systemUserId) {
    return {
      ok: false,
      status: 503,
      error: "Internal optimizer endpoint is not configured.",
    };
  }
  if (!generation) {
    return { ok: false, status: 404, error: "Generation not found." };
  }
  if (generation.userId !== systemUserId) {
    // Customer generation: deny without revealing existence.
    return { ok: false, status: 404, error: "Generation not found." };
  }
  if (generation.status !== "COMPLETED") {
    return {
      ok: false,
      status: 409,
      error: `Generation is ${generation.status}, not COMPLETED.`,
    };
  }
  if (!generation.resultStorageKey) {
    return {
      ok: false,
      status: 409,
      error: "Generation has no result artifact.",
    };
  }
  return { ok: true };
}
