import { GoogleGenAI } from "@google/genai";

import {
  ProviderGenerationRequest,
  ProviderGenerationResult,
} from "../types";

/**
 * Lazily create the Vertex AI client.
 * This prevents initialization during module import,
 * which can break Next.js builds when credentials are
 * unavailable at build time.
 */
function getVertexClient(): GoogleGenAI {
  const project = process.env.GOOGLE_CLOUD_PROJECT_ID;
  const location = process.env.GOOGLE_CLOUD_LOCATION;

  if (!project) {
    throw new Error(
      "Missing environment variable: GOOGLE_CLOUD_PROJECT_ID"
    );
  }

  if (!location) {
    throw new Error(
      "Missing environment variable: GOOGLE_CLOUD_LOCATION"
    );
  }

  return new GoogleGenAI({
    vertexai: true,
    project,
    location,
  });
}

export async function generateWithVertex(
  request: ProviderGenerationRequest
): Promise<ProviderGenerationResult> {
  try {
    const ai = getVertexClient();

    const response = await ai.models.generateContent({
      model: "gemini-3-pro-image",
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
            {
              text: request.prompt,
            },
          ],
        },
      ],
      config: {
        responseModalities: ["TEXT", "IMAGE"],
      },
    });

    const imagePart =
      response.candidates?.[0]?.content?.parts?.find(
        (part: any) => part.inlineData
      );

    if (!imagePart?.inlineData?.data) {
      return {
        success: false,
        error: "Vertex AI returned no image.",
      };
    }

    return {
      success: true,
      provider: "vertex",
      providerModel: "gemini-3-pro-image",
      imageBuffer: Buffer.from(
        imagePart.inlineData.data,
        "base64"
      ),
      mimeType: imagePart.inlineData.mimeType ?? "image/png",
    };
  } catch (error) {
    console.error("Vertex Provider Error:", error);

    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Vertex AI request failed.",
    };
  }
}