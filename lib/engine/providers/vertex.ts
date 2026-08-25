import { GoogleGenAI } from "@google/genai";
import sharp from "sharp";
import {
  ProviderGenerationRequest,
  ProviderGenerationResult,
} from "../types";

export const VERTEX_PROVIDER = "vertex";
export const VERTEX_MODEL = "gemini-3-pro-image";
export const VERTEX_IMAGE_SIZE = "1K";

function getVertexClient(): GoogleGenAI {
  const project = process.env.GOOGLE_CLOUD_PROJECT_ID;
  const location = process.env.GOOGLE_CLOUD_LOCATION;
  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

  if (!project) {
    throw new Error("Missing environment variable: GOOGLE_CLOUD_PROJECT_ID");
  }
  if (!location) {
    throw new Error("Missing environment variable: GOOGLE_CLOUD_LOCATION");
  }
  if (!serviceAccountJson) {
    throw new Error("Missing environment variable: GOOGLE_SERVICE_ACCOUNT_JSON");
  }

  let credentials: Record<string, unknown>;
  try {
    credentials = JSON.parse(serviceAccountJson);
  } catch {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON contains invalid JSON.");
  }

  return new GoogleGenAI({
    vertexai: true,
    project,
    location,
    googleAuthOptions: { credentials },
  });
}

export async function generateWithVertex(
  request: ProviderGenerationRequest
): Promise<ProviderGenerationResult> {
  const providerStartedAt = performance.now();
  const providerStartedWallClock = new Date().toISOString();

  console.info("[GENERATION_TIMING] provider start", {
    model: VERTEX_MODEL,
    imageSize: VERTEX_IMAGE_SIZE,
    inputBytes: request.imageBuffer.length,
    at: providerStartedWallClock,
  });

  try {
    const ai = getVertexClient();

    const response = await ai.models.generateContent({
      model: VERTEX_MODEL,
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType: request.mimeType,
                data: request.imageBuffer.toString("base64"),
              },
            },
            { text: request.prompt },
          ],
        },
      ],
      config: {
        responseModalities: ["IMAGE"],
        imageConfig: {
          aspectRatio: request.metadata.aspectRatio,
          imageSize: VERTEX_IMAGE_SIZE,
        },
      },
    });

    const providerResponseMs = Math.round(performance.now() - providerStartedAt);
    console.info("[GENERATION_TIMING] provider response", {
      model: VERTEX_MODEL,
      imageSize: VERTEX_IMAGE_SIZE,
      providerResponseMs,
      at: new Date().toISOString(),
    });

    const candidate = response.candidates?.[0];
    const imagePart = candidate?.content?.parts?.find(
      (part: any) => part.inlineData
    );

    if (!imagePart?.inlineData?.data) {
      const finishReason = String(candidate?.finishReason ?? "unknown");
      const normalizedReason = finishReason.toLowerCase();
      const blocked = [
        "safety",
        "blocklist",
        "prohibited",
        "recitation",
        "policy",
      ].some((pattern) => normalizedReason.includes(pattern));

      return {
        success: false,
        error: blocked
          ? `Vertex AI blocked the image request (${finishReason}).`
          : `Vertex AI returned no image (finish reason: ${finishReason}).`,
      };
    }

    const outputBuffer = Buffer.from(imagePart.inlineData.data, "base64");
    const meta = await sharp(outputBuffer).metadata();

    if (!meta.width || !meta.height) {
      return {
        success: false,
        error: "Vertex AI returned an image with invalid dimensions.",
      };
    }

    if (process.env.DEBUG_VERTEX === "true") {
      console.debug("Vertex generation completed", {
        model: VERTEX_MODEL,
        imageSize: VERTEX_IMAGE_SIZE,
        inputBytes: request.imageBuffer.length,
        inputWidth: request.metadata.width,
        inputHeight: request.metadata.height,
        inputAspectRatio: request.metadata.aspectRatio,
        outputWidth: meta.width,
        outputHeight: meta.height,
        outputMimeType: imagePart.inlineData.mimeType ?? "image/png",
      });
    }

    return {
      success: true,
      provider: VERTEX_PROVIDER,
      providerModel: VERTEX_MODEL,
      imageBuffer: outputBuffer,
      mimeType: imagePart.inlineData.mimeType ?? "image/png",
    };
  } catch (error) {
    const providerErrorMs = Math.round(performance.now() - providerStartedAt);
    console.error("Vertex AI request failed:", error, {
      providerErrorMs,
      at: new Date().toISOString(),
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Vertex AI request failed.",
    };
  }
}
