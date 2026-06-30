import crypto from "crypto";

import {
  GenerationContext,
  GenerationResult,
  ProviderGenerationRequest,
} from "../types";

import { validateGenerationRequest } from "../validators/generationValidator";
import { buildPrompt } from "./promptBuilder";
import { generateWithGemini } from "../providers/gemini";

/**
 * ============================================================
 * Draft My Hair
 * Generation Service
 * ============================================================
 *
 * Coordinates the complete hairstyle generation pipeline.
 *
 * Pipeline:
 *
 * Request
 *    ↓
 * Validation
 *    ↓
 * Prompt Builder
 *    ↓
 * Gemini Provider
 *    ↓
 * Storage (temporary placeholder)
 *    ↓
 * Response
 */

export async function generatePreview(
  context: GenerationContext
): Promise<GenerationResult> {
  // ============================================================
  // Step 1 — Validate Request
  // ============================================================

  const validation = validateGenerationRequest(context);

  if (!validation.valid) {
    return {
      success: false,
      error: validation.error,
    };
  }

  // ============================================================
  // Step 2 — Build Prompt
  // ============================================================

  const promptResult = buildPrompt({
    styleId: context.styleId,
  });

  // ============================================================
  // Step 3 — Prepare Provider Request
  // ============================================================

  const providerRequest: ProviderGenerationRequest = {
    imageBuffer: context.imageBuffer,
    mimeType: context.mimeType,
    prompt: promptResult.prompt,
  };

  // ============================================================
  // Step 4 — Generate Image
  // ============================================================

  const providerResult = await generateWithGemini(providerRequest);

  if (!providerResult.success) {
    return {
      success: false,
      error: providerResult.error,
    };
  }

  if (!providerResult.imageBuffer) {
    return {
      success: false,
      error: "Provider did not return an image.",
    };
  }

  // ============================================================
  // Step 5 — Temporary Storage
  // ============================================================
  //
  // This is intentionally temporary.
  //
  // Later we'll replace this with:
  //
  // - Vercel Blob
  // - Cloudflare R2
  // - Amazon S3
  // - Local storage (development)
  //
  // The provider should NEVER be responsible
  // for storing files.
  //
  // ============================================================

  const imageUrl = "/images/placeholders/generated-preview.jpg";

  // ============================================================
  // Step 6 — Return Result
  // ============================================================

  return {
    success: true,
    imageUrl,
    jobId: crypto.randomUUID(),
  };
}