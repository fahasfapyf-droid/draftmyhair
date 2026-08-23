import { GoogleGenAI } from "@google/genai";
import sharp from "sharp";
import {
  ProviderGenerationRequest,
  ProviderGenerationResult,
} from "../types";

export const VERTEX_PROVIDER = "vertex";

// Benchmark-only configuration. The main branch remains on Gemini 3 Pro Image 2K.
// Keep the V3.2 prompt and the rest of the generation pipeline unchanged so the
// model comparison isolates model/resolution effects.
export const VERTEX_MODEL = "gemini-3.1-flash-image";
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

    const imagePart = response.candidates?.[0]?.content?.parts?.find(
      (part: any) => part.inlineData
    );

    if (!imagePart?.inlineData?.data) {
      return { success: false, error: "Vertex AI returned no image." };
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
    console.error("Vertex AI request failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Vertex AI request failed.",
    };
  }
}
