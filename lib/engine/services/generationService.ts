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

const PROVIDER_RETRY_DELAYS_MS = [1000, 2000, 4000];

function isRetryableGenerationError(error: unknown) {
  const message =
    error instanceof Error
      ? error.message.toLowerCase()
      : String(error).toLowerCase();

  const retryablePatterns = [
    "timeout",
    "timed out",
    "deadline",
    "429",
    "500",
    "502",
    "503",
    "504",
    "network",
    "connection",
    "unavailable",
    "temporarily",
    "internal server error",
  ];

  return retryablePatterns.some((pattern) => message.includes(pattern));
}

function delay(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function waitBeforeProviderRetry(attempt: number) {
  const baseDelay = PROVIDER_RETRY_DELAYS_MS[attempt - 1];
  const jitter = Math.floor(Math.random() * 250);

  await delay(baseDelay + jitter);
}

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
      metadata: context.metadata,
      prompt: promptResult.prompt,
    };

    // ============================================================
    // Step 4 — Generate Image
    // ============================================================
    // The Vertex provider currently returns transient provider failures as
    // { success: false } rather than throwing. Retry them here so the existing
    // execution-layer retry wrapper is not bypassed for 429/5xx responses.

    let providerResult: Awaited<ReturnType<typeof generateWithVertex>>;

    for (let attempt = 1; attempt <= PROVIDER_RETRY_DELAYS_MS.length + 1; attempt++) {
      providerResult = await generateWithVertex(providerRequest);

      if (providerResult.success) {
        break;
      }

      const retryable = isRetryableGenerationError(providerResult.error);
      const hasRetryRemaining = attempt <= PROVIDER_RETRY_DELAYS_MS.length;

      if (!retryable || !hasRetryRemaining) {
        return {
          success: false,
          error: providerResult.error ?? "Image generation failed.",
        };
      }

      console.warn(
        `Transient Vertex generation failure on attempt ${attempt}. Retrying...`,
        {
          error: providerResult.error,
          nextAttempt: attempt + 1,
        }
      );

      await waitBeforeProviderRetry(attempt);
    }

    if (!providerResult!.success) {
      return {
        success: false,
        error: providerResult!.error ?? "Image generation failed.",
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
