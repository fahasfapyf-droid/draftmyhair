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

export function validateGenerationRequest(
  context: GenerationContext
): ValidationResult {
  if (!context.styleId) {
    return {
      valid: false,
      error: "Missing hairstyle.",
    };
  }

  if (!context.imageBuffer || context.imageBuffer.length === 0) {
    return {
      valid: false,
      error: "Missing image.",
    };
  }

  if (!context.mimeType) {
    return {
      valid: false,
      error: "Missing MIME type.",
    };
  }

  return {
    valid: true,
  };
}