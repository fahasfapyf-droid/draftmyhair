/**
 * ============================================================
 * Draft My Hair Engine
 * Shared Type Definitions
 * ============================================================
 */

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
   * Uploaded image.
   */
  imageBuffer: Buffer;

  /**
   * MIME type.
   */
  mimeType: string;

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
  success: boolean;

  /**
   * Generated image bytes for server-side persistence.
   */
  imageBuffer?: Buffer;

  /**
   * MIME type of the generated image.
   */
  mimeType?: string;

  /**
   * Public URL of the generated image.
   *
   * This is produced AFTER the image has been
   * saved by the application.
   */
  imageUrl?: string;

  /**
   * Unique generation identifier.
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
  promptKey: string;
}

export interface PromptBuildResult {
  /**
   * Final production prompt.
   */
  prompt: string;
}

/* ============================================================
   AI PROVIDER
============================================================ */

export interface ProviderGenerationRequest {
  /**
   * Source image.
   */
  imageBuffer: Buffer;

  /**
   * Source MIME type.
   */
  mimeType: string;

  /**
   * Final generated prompt.
   */
  prompt: string;

  /**
   * Provider-specific options.
   */
  options?: {
    model?: string;
    temperature?: number;
    maxOutputTokens?: number;
  };
}

export interface ProviderGenerationResult {
  success: boolean;

  /**
   * Raw generated image returned by Gemini.
   */
  imageBuffer?: Buffer;

  /**
   * MIME type of generated image.
   */
  mimeType?: string;

  /**
   * Error returned by provider.
   */
  error?: string;
}
