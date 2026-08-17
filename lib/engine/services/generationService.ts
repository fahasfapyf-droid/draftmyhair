import crypto from "crypto";

import { GenerationContext, GenerationResult, ProviderGenerationRequest } from "../types";
import { validateGenerationRequest } from "../validators/generationValidator";
import { PROMPT_VERSION } from "../prompts/master";
import { generateWithVertex, VERTEX_MODEL, VERTEX_PROVIDER } from "../providers/vertex";
import { buildPrompt } from "./promptBuilder";

const PROVIDER_RETRY_DELAYS_MS = [1000, 2000, 4000];

function isRetryableGenerationError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return ["timeout", "timed out", "deadline", "429", "500", "502", "503", "504", "network", "connection", "unavailable", "temporarily", "internal server error"].some((pattern) => message.includes(pattern));
}

function delay(ms: number) { return new Promise((resolve) => setTimeout(resolve, ms)); }

async function waitBeforeProviderRetry(attempt: number) {
  const baseDelay = PROVIDER_RETRY_DELAYS_MS[attempt - 1];
  await delay(baseDelay + Math.floor(Math.random() * 250));
}

export function getGenerationMetadata() {
  return { promptVersion: PROMPT_VERSION, provider: VERTEX_PROVIDER, providerModel: VERTEX_MODEL };
}

export async function generatePreview(context: GenerationContext): Promise<GenerationResult> {
  try {
    const validation = validateGenerationRequest(context);
    if (!validation.valid) return { success: false, error: validation.error };

    const promptResult = await buildPrompt({ promptKey: context.promptKey });
    const providerRequest: ProviderGenerationRequest = {
      imageBuffer: context.imageBuffer,
      mimeType: context.mimeType,
      metadata: context.metadata,
      prompt: promptResult.prompt,
    };

    let providerResult: Awaited<ReturnType<typeof generateWithVertex>> | null = null;
    for (let attempt = 1; attempt <= PROVIDER_RETRY_DELAYS_MS.length + 1; attempt++) {
      providerResult = await generateWithVertex(providerRequest);
      if (providerResult.success) break;
      const retryable = isRetryableGenerationError(providerResult.error);
      const hasRetryRemaining = attempt <= PROVIDER_RETRY_DELAYS_MS.length;
      if (!retryable || !hasRetryRemaining) {
        return { success: false, error: providerResult.error ?? "Image generation failed." };
      }
      console.warn(`Transient Vertex generation failure on attempt ${attempt}. Retrying...`, {
        error: providerResult.error,
        nextAttempt: attempt + 1,
      });
      await waitBeforeProviderRetry(attempt);
    }

    if (!providerResult) return { success: false, error: "Image generation failed." };
    if (!providerResult.success) return { success: false, error: providerResult.error ?? "Image generation failed." };
    if (!providerResult.imageBuffer) return { success: false, error: "Provider returned no image." };
    if (!providerResult.provider || !providerResult.providerModel) {
      return { success: false, error: "Provider returned incomplete metadata." };
    }

    const generationId = crypto.randomUUID();
    const imageUrl = "/images/placeholders/generated-preview.jpg";

    return {
      success: true,
      promptVersion: promptResult.promptVersion,
      provider: providerResult.provider,
      providerModel: providerResult.providerModel,
      imageBuffer: providerResult.imageBuffer,
      mimeType: providerResult.mimeType,
      imageUrl,
      generationId,
    };
  } catch (error) {
    console.error("Generation pipeline failed:", error);
    return { success: false, error: "Internal generation error." };
  }
}
