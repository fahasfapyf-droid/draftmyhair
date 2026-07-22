import { GenerationContext } from "../types";

/**
 * ============================================================
 * Draft My Hair
 * Generation Validator
 * ============================================================
 *
 * Validates a generation request before it reaches
 * the AI provider.
 */

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

const MAX_IMAGE_SIZE = 20 * 1024 * 1024; // 20 MB

export function validateGenerationRequest(
  context: GenerationContext
): ValidationResult {
  // ------------------------------------------------------------
  // Hairstyle
  // ------------------------------------------------------------

  if (!context.promptKey || context.promptKey.trim().length === 0) {
    return {
      valid: false,
      error: "Missing hairstyle.",
    };
  }

  // ------------------------------------------------------------
  // Image
  // ------------------------------------------------------------

  if (!context.imageBuffer || context.imageBuffer.length === 0) {
    return {
      valid: false,
      error: "Missing image.",
    };
  }

  if (context.imageBuffer.length > MAX_IMAGE_SIZE) {
    return {
      valid: false,
      error: "Image exceeds the 20 MB upload limit.",
    };
  }

  // ------------------------------------------------------------
  // MIME Type
  // ------------------------------------------------------------

  if (!context.mimeType) {
    return {
      valid: false,
      error: "Missing MIME type.",
    };
  }

  if (!ALLOWED_MIME_TYPES.includes(context.mimeType)) {
    return {
      valid: false,
      error: `Unsupported image format: ${context.mimeType}`,
    };
  }

  // ------------------------------------------------------------
  // Success
  // ------------------------------------------------------------

  return {
    valid: true,
  };
}