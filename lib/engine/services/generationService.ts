import crypto from "crypto";

import {
  GenerationContext,
  GenerationResult,
  ProviderGenerationRequest,
} from "../types";

import { validateGenerationRequest } from "../validators/generationValidator";
import { PROMPT_VERSION } from "../prompts/master";
import {
  generateWithVertex,
  VERTEX_MODEL,
  VERTEX_PROVIDER,
} from "../providers/vertex";
import { buildPrompt } from "./promptBuilder";

/**
 * ============================================================
 * Draft My Hair
 * Generation Service
 * ============================================================
 *
 * Coordinates the complete hairstyle generation pipeline.
 */

export function getGenerationMetadata() {
  return {
    promptVersion: PROMPT_VERSION,
    provider: VERTEX_PROVIDER,
    providerModel: VERTEX_MODEL,
  };
}

export async function generatePreview(
  context: GenerationContext
): Promise<GenerationResult> {
  try {
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
      promptKey: context.promptKey,
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

    const providerResult = await generateWithVertex(providerRequest);

    if (!providerResult.success) {
      return {
        success: false,
        error: providerResult.error ?? "Image generation failed.",
      };
    }

    if (!providerResult.imageBuffer) {
      return {
        success: false,
        error: "Provider returned no image.",
      };
    }

    if (!providerResult.provider || !providerResult.providerModel) {
      return {
        success: false,
        error: "Provider returned incomplete metadata.",
      };
    }

    // ============================================================
    // Step 5 — Storage (Temporary)
    // ============================================================

    /**
     * TODO
     * Replace with:
     * - Vercel Blob
     * - Cloudflare R2
     * - Amazon S3
     */

    const generationId = crypto.randomUUID();

    const imageUrl =
      "/images/placeholders/generated-preview.jpg";

    // ============================================================
    // Step 6 — Return
    // ============================================================

    return {
      success: true,
      promptVersion: getGenerationMetadata().promptVersion,
      provider: providerResult.provider,
      providerModel: providerResult.providerModel,
      imageBuffer: providerResult.imageBuffer,
      mimeType: providerResult.mimeType,
      imageUrl,
      generationId,
    };
  } catch (error) {
    console.error("Generation pipeline failed:", error);

    return {
      success: false,
      error: "Internal generation error.",
    };
  }
}
