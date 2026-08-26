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
const RATE_LIMIT_RETRY_DELAY_MS = 5000;
const RATE_LIMIT_RETRY_JITTER_MS = 1000;
const RATE_LIMIT_ERROR_PREFIX = "[RATE_LIMIT_429]";
const RATE_LIMIT_USER_MESSAGE =
  "We're experiencing a temporary system issue. Your credit has been returned. Please try again in a few minutes.";

function isRateLimitError(error: unknown) {
  const message =
    error instanceof Error
      ? error.message.toLowerCase()
      : String(error).toLowerCase();

  return message.includes("429") || message.includes("rate limit");
}

function isRetryableGenerationError(error: unknown) {
  const message =
    error instanceof Error
      ? error.message.toLowerCase()
      : String(error).toLowerCase();

  const nonRetryablePatterns = [
    "blocked the image request",
    "safety",
    "blocklist",
    "prohibited",
    "recitation",
    "policy",
  ];

  if (nonRetryablePatterns.some((pattern) => message.includes(pattern))) {
    return false;
  }

  const retryablePatterns = [
    "timeout",
    "timed out",
    "deadline",
    "500",
    "502",
    "503",
    "504",
    "network",
    "connection",
    "unavailable",
    "temporarily",
    "internal server error",
    "returned no image",
    "invalid dimensions",
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

async function waitBeforeRateLimitRetry() {
  const jitter = Math.floor(Math.random() * RATE_LIMIT_RETRY_JITTER_MS);
  await delay(RATE_LIMIT_RETRY_DELAY_MS + jitter);
}

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
    const validation = validateGenerationRequest(context);

    if (!validation.valid) {
      return {
        success: false,
        error: validation.error,
      };
    }

    const promptResult = await buildPrompt({
      promptKey: context.promptKey,
    });

    console.log(
      "[GENERATION_PROMPT_PROVENANCE]",
      JSON.stringify(promptResult.diagnostics)
    );

    const providerRequest: ProviderGenerationRequest = {
      imageBuffer: context.imageBuffer,
      mimeType: context.mimeType,
      metadata: context.metadata,
      prompt: promptResult.prompt,
    };

    let providerResult: Awaited<ReturnType<typeof generateWithVertex>> | null = null;
    let rateLimitRetried = false;

    for (let attempt = 1; attempt <= PROVIDER_RETRY_DELAYS_MS.length + 1; attempt++) {
      providerResult = await generateWithVertex(providerRequest);

      if (providerResult.success) {
        break;
      }

      if (isRateLimitError(providerResult.error)) {
        if (rateLimitRetried) {
          return {
            success: false,
            error: `${RATE_LIMIT_ERROR_PREFIX} ${RATE_LIMIT_USER_MESSAGE}`,
          };
        }

        rateLimitRetried = true;
        console.warn("Vertex 429 RESOURCE_EXHAUSTED. Retrying once with backoff...", {
          error: providerResult.error,
          retryDelayMs: RATE_LIMIT_RETRY_DELAY_MS,
          retryAttempt: 2,
        });

        await waitBeforeRateLimitRetry();
        continue;
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

    if (!providerResult) {
      return {
        success: false,
        error: "Image generation failed.",
      };
    }

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

    const generationId = crypto.randomUUID();
    const imageUrl = "/images/placeholders/generated-preview.jpg";

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
