/**
 * ============================================================
 * Draft My Hair Engine
 * Shared Type Definitions
 * ============================================================
 */

import { SourceImageMetadata } from "@/lib/image/types";

/* ============================================================
   API LAYER
============================================================ */

export interface GenerateRequestDTO {
  /**
   * Selected hairstyle prompt key.
   */
  promptKey: string;

  /**
   * Optional user identifier.
   */
  userId?: string;
}

/* ============================================================
   ENGINE LAYER
============================================================ */

export interface GenerationContext {
  /**
   * Original uploaded image.
   */
  imageBuffer: Buffer;

  /**
   * Source MIME type.
   */
  mimeType: string;

  /**
   * Metadata extracted from the source image.
   */
  metadata: SourceImageMetadata;

  /**
   * Selected hairstyle prompt key.
   */
  promptKey: string;

  /**
   * Optional user identifier.
   */
  userId?: string;
}

export interface GenerationResult {
  /**
   * Whether generation completed successfully.
   */
  success: boolean;

  /**
   * Version of the production prompt.
   */
  promptVersion?: string;

  /**
   * Provider identifier.
   */
  provider?: string;

  /**
   * Provider model identifier.
   */
  providerModel?: string;

  /**
   * Generated image bytes.
   */
  imageBuffer?: Buffer;

  /**
   * Generated image MIME type.
   */
  mimeType?: string;

  /**
   * Public URL after persistence.
   */
  imageUrl?: string;

  /**
   * Generation identifier.
   */
  generationId?: string;

  /**
   * Error message.
   */
  error?: string;
}

/* ============================================================
   PROMPT BUILDER
============================================================ */

export interface PromptBuildRequest {
  /**
   * Selected hairstyle prompt key.
   */
  promptKey: string;
}

export interface PromptBuildResult {
  /**
   * Final compiled production prompt.
   */
  prompt: string;
}

/* ============================================================
   AI PROVIDER
============================================================ */

export interface ProviderGenerationRequest {
  /**
   * Original uploaded image.
   */
  imageBuffer: Buffer;

  /**
   * Source MIME type.
   */
  mimeType: string;

  /**
   * Source image metadata.
   *
   * Provider implementations may use this
   * for aspect ratio, orientation, validation,
   * logging, or provider-specific optimizations.
   */
  metadata: SourceImageMetadata;

  /**
   * Final compiled production prompt.
   */
  prompt: string;

  /**
   * Provider-specific generation options.
   */
  options?: {
    model?: string;
    temperature?: number;
    maxOutputTokens?: number;
  };
}

export interface ProviderGenerationResult {
  /**
   * Whether generation completed successfully.
   */
  success: boolean;

  /**
   * Provider identifier.
   */
  provider?: string;

  /**
   * Provider model identifier.
   */
  providerModel?: string;

  /**
   * Raw generated image.
   */
  imageBuffer?: Buffer;

  /**
   * Generated image MIME type.
   */
  mimeType?: string;

  /**
   * Provider error.
   */
  error?: string;
}