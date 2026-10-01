/**
 * ============================================================
 * Draft My Hair — Internal optimizer request validation
 * ============================================================
 *
 * Pure, dependency-free parser for the internal optimizer generate
 * endpoint. Kept free of next/prisma imports so it can be unit-tested
 * directly with node:test.
 *
 * Accepted multipart fields (v2.3 contract):
 *   reference      file   (image/jpeg | image/png, <= 10 MB)
 *   promptBlock    text   (candidate prompt/style block)
 *   generationId   text   (uuid, optional -> generated)
 *   experimentId   text   (optional)
 *   metadata       text   (JSON object string, optional)
 *
 * carrierPromptKey: because Generation.hairstyleId is a non-null FK, the
 * endpoint records a PROVENANCE carrier promptKey on the Generation row.
 * The provider NEVER receives the carrier's style — it receives only
 * promptBlock (via promptOverride). Default carrier from env
 * INTERNAL_CARRIER_PROMPT_KEY, falling back to an existing production
 * promptKey. No new hairstyle/prompt version is created.
 */
import crypto from "node:crypto";

export const DEFAULT_CARRIER_PROMPT_KEY = "structured-blunt-bob";
export const MAX_PROMPT_BLOCK_LENGTH = 8000;
export const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png"];
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB

export class InternalRequestError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "InternalRequestError";
    this.status = status;
  }
}

export type ParsedInternalOptimizerRequest = {
  promptBlock: string;
  generationId: string;
  experimentId: string | null;
  metadata: Record<string, unknown> | null;
  carrierPromptKey: string;
  image: {
    buffer: Buffer;
    mimeType: string;
  };
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function parseInternalOptimizerRequest(
  formData: FormData,
  envCarrierPromptKey: string | undefined
): Promise<ParsedInternalOptimizerRequest> {
  const reference = formData.get("reference");
  if (!(reference instanceof File)) {
    throw new InternalRequestError("Reference image is required.");
  }

  const mimeType = reference.type.toLowerCase();
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    throw new InternalRequestError(`Unsupported image format: ${mimeType}`);
  }

  const imageBuffer = Buffer.from(await reference.arrayBuffer());
  if (imageBuffer.length === 0) {
    throw new InternalRequestError("Reference image is empty.");
  }
  if (imageBuffer.length > MAX_IMAGE_BYTES) {
    throw new InternalRequestError(
      "Reference image exceeds the 10 MB limit."
    );
  }

  const promptBlock = formData.get("promptBlock");
  if (typeof promptBlock !== "string" || promptBlock.trim().length === 0) {
    throw new InternalRequestError("promptBlock is required.");
  }
  const trimmedPrompt = promptBlock.trim();
  if (trimmedPrompt.length > MAX_PROMPT_BLOCK_LENGTH) {
    throw new InternalRequestError(
      `promptBlock exceeds ${MAX_PROMPT_BLOCK_LENGTH} characters.`
    );
  }

  let generationId: string;
  const rawGenerationId = formData.get("generationId");
  if (
    typeof rawGenerationId === "string" &&
    rawGenerationId.trim().length > 0
  ) {
    const candidate = rawGenerationId.trim();
    if (!UUID_PATTERN.test(candidate)) {
      throw new InternalRequestError("generationId must be a UUID.");
    }
    generationId = candidate;
  } else {
    generationId = crypto.randomUUID();
  }

  const rawExperimentId = formData.get("experimentId");
  const experimentId =
    typeof rawExperimentId === "string" && rawExperimentId.trim().length > 0
      ? rawExperimentId.trim()
      : null;

  let metadata: Record<string, unknown> | null = null;
  const rawMetadata = formData.get("metadata");
  if (typeof rawMetadata === "string" && rawMetadata.trim().length > 0) {
    try {
      const parsed = JSON.parse(rawMetadata) as unknown;
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        throw new Error("not an object");
      }
      metadata = parsed as Record<string, unknown>;
    } catch {
      throw new InternalRequestError(
        "metadata must be a JSON object string."
      );
    }
  }

  const carrierPromptKey =
    envCarrierPromptKey?.trim() || DEFAULT_CARRIER_PROMPT_KEY;

  return {
    promptBlock: trimmedPrompt,
    generationId,
    experimentId,
    metadata,
    carrierPromptKey,
    image: { buffer: imageBuffer, mimeType },
  };
}
