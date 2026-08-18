/**
 * ============================================================
 * Draft My Hair Engine
 * Shared Type Definitions
 * ============================================================
 */

import { SourceImageMetadata } from "@/lib/image/types";

export interface GenerateRequestDTO {
  promptKey: string;
  userId?: string;
}

export interface GenerationContext {
  imageBuffer: Buffer;
  mimeType: string;
  metadata: SourceImageMetadata;
  promptKey: string;
  userId?: string;
}

export interface GenerationResult {
  success: boolean;
  promptVersion?: string;
  provider?: string;
  providerModel?: string;
  imageBuffer?: Buffer;
  mimeType?: string;
  imageUrl?: string;
  generationId?: string;
  error?: string;
}

export interface PromptBuildRequest {
  promptKey: string;
}

export interface PromptBuildResult {
  prompt: string;
  promptVersion: string;
}

export interface ProviderGenerationRequest {
  imageBuffer: Buffer;
  mimeType: string;
  metadata: SourceImageMetadata;
  prompt: string;
  options?: {
    model?: string;
    temperature?: number;
    maxOutputTokens?: number;
  };
}

export interface ProviderGenerationResult {
  success: boolean;
  provider?: string;
  providerModel?: string;
  imageBuffer?: Buffer;
  mimeType?: string;
  error?: string;
}
