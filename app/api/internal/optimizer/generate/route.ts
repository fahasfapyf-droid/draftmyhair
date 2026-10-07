import { NextResponse } from "next/server";

import { getGenerationMetadata } from "@/lib/engine";
import { normalizeImage } from "@/lib/image/normalize";
import { InternalAccessError, requireInternalAccess } from "@/lib/internal/auth";
import {
  InternalRequestError,
  parseInternalOptimizerRequest,
} from "@/lib/internal/optimizer-request";
import {
  internalOptimizerLimiter,
  requireExperimentId,
} from "@/lib/internal/limits";
import {
  createGeneratePreviewJob,
  runGeneratePreviewJob,
} from "@/lib/jobs/generate-preview.job";

export const maxDuration = 300;

/**
 * ============================================================
 * Draft My Hair — Internal Optimizer: Generate
 * ============================================================
 *
 * Protected endpoint for the DMH Prompt Lab. Server-only (Bearer
 * DMH_INTERNAL_TOKEN). Accepts a reference image + candidate prompt/style
 * block, runs the EXISTING generation pipeline with promptOverride, and
 * NEVER consumes customer credits. Public /api/generate is untouched.
 *
 * Response follows the existing synchronous execution model (same as the
 * public route): the generation finishes before this returns, and the
 * status endpoint remains available for retrieval/audit.
 */
export async function POST(request: Request) {
  try {
    requireInternalAccess(request.headers.get("authorization"));
  } catch (error) {
    if (error instanceof InternalAccessError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.status }
      );
    }
    throw error;
  }

  const systemUserId = process.env.INTERNAL_SYSTEM_USER_ID;
  if (!systemUserId) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Internal optimizer endpoint is not configured (INTERNAL_SYSTEM_USER_ID).",
      },
      { status: 503 }
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid multipart request." },
      { status: 400 }
    );
  }

  let parsed;
  try {
    parsed = await parseInternalOptimizerRequest(
      formData,
      process.env.INTERNAL_CARRIER_PROMPT_KEY
    );
  } catch (error) {
    if (error instanceof InternalRequestError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.status }
      );
    }
    throw error;
  }

  let normalized;
  try {
    normalized = await normalizeImage(parsed.image.buffer, parsed.image.mimeType);
  } catch {
    return NextResponse.json(
      { success: false, error: "Image normalization failed." },
      { status: 400 }
    );
  }

  // ---- Abuse protection (server-side, fail closed) ---------------------
  // skipCredits=true bypasses customer credits, so every accepted start is
  // gated: experiment id required + valid, per-experiment quota, concurrency
  // cap, and a per-minute rate limit (env-configurable; stricter in tests).
  const experiment = requireExperimentId(parsed.experimentId);
  if (!experiment.ok) {
    return NextResponse.json(
      { success: false, error: experiment.reason },
      { status: experiment.status }
    );
  }
  parsed.experimentId = experiment.value;

  const limits = internalOptimizerLimiter.tryStart(
    parsed.experimentId,
    parsed.generationId
  );
  if (!limits.ok) {
    console.log(
      "[INTERNAL_LIMITS_REJECTED]",
      JSON.stringify({
        experimentId: parsed.experimentId,
        generationId: parsed.generationId,
        status: limits.status,
        reason: limits.reason,
      })
    );
    return NextResponse.json(
      { success: false, error: limits.reason },
      { status: limits.status }
    );
  }
  console.log(
    "[INTERNAL_LIMITS_ACCEPTED]",
    JSON.stringify({
      experimentId: parsed.experimentId,
      generationId: parsed.generationId,
    })
  );

  try {
    const jobPreparation = await createGeneratePreviewJob({
      generationId: parsed.generationId,
      userId: systemUserId,
      promptKey: parsed.carrierPromptKey,
      imageBuffer: normalized.buffer,
      mimeType: normalized.mimeType,
      promptOverride: parsed.promptBlock,
      skipCredits: true,
      metadata: {
        experimentId: parsed.experimentId,
        internal: true,
        ...(parsed.metadata ?? {}),
      },
    });

    if (!jobPreparation.ok) {
      return NextResponse.json(
        { success: false, error: jobPreparation.error },
        { status: jobPreparation.status }
      );
    }

    const execution = await runGeneratePreviewJob(jobPreparation.job);

    if (!execution.ok) {
      return NextResponse.json(
        { success: false, error: execution.error },
        { status: execution.status }
      );
    }

    return NextResponse.json(
      {
        success: true,
        generationId: execution.generationId,
        imageUrl: execution.imageUrl,
        status: "COMPLETED",
        model: getGenerationMetadata().providerModel,
      },
      { status: 200 }
    );
  } finally {
    // Always release the concurrency slot + rate-limit token, success or not.
    internalOptimizerLimiter.finish(parsed.generationId);
  }
}
