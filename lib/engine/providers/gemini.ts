import {
  ProviderGenerationRequest,
  ProviderGenerationResult,
} from "../types";

/**
 * ============================================================
 * Draft My Hair
 * Gemini Provider
 * ============================================================
 *
 * Temporary mock implementation.
 *
 * The next step will replace this entire file with the real
 * Google Gemini API integration.
 */

export async function generateWithGemini(
  request: ProviderGenerationRequest
): Promise<ProviderGenerationResult> {
  try {
    // Silence unused variable warning until real integration.
    void request;

    /**
     * Simulate AI processing.
     */
    await new Promise((resolve) => setTimeout(resolve, 3000));

    /**
     * Temporary placeholder image buffer.
     *
     * This will be replaced by the image bytes returned
     * from the Gemini API.
     */
    const placeholderBuffer = Buffer.from("Draft My Hair Placeholder");

    return {
      success: true,
      imageBuffer: placeholderBuffer,
      mimeType: "image/png",
    };
  } catch (error) {
    console.error("Gemini Provider Error:", error);

    return {
      success: false,
      error: "Failed to generate preview.",
    };
  }
}