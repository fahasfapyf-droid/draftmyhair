import { GoogleGenAI } from "@google/genai";

import {
  ProviderGenerationRequest,
  ProviderGenerationResult,
} from "../types";

export const VERTEX_PROVIDER = "vertex";
export const VERTEX_MODEL = "gemini-3-pro-image";

/**
 * Lazily create the Vertex AI client.
 * This prevents initialization during module import,
 * which can break Next.js builds when credentials are
 * unavailable at build time.
 */
function getVertexClient(): GoogleGenAI {
  const project = process.env.GOOGLE_CLOUD_PROJECT_ID;
  const location = process.env.GOOGLE_CLOUD_LOCATION;
  const serviceAccountJson =
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

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

  if (!serviceAccountJson) {
    throw new Error(
      "Missing environment variable: GOOGLE_SERVICE_ACCOUNT_JSON"
    );
  }

  let credentials: Record<string, unknown>;

  try {
    credentials = JSON.parse(serviceAccountJson);
  } catch {
    throw new Error(
      "GOOGLE_SERVICE_ACCOUNT_JSON contains invalid JSON."
    );
  }

  return new GoogleGenAI({
    vertexai: true,
    project,
    location,
    googleAuthOptions: {
      credentials,
    },
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
      provider: VERTEX_PROVIDER,
      providerModel: VERTEX_MODEL,
      imageBuffer: Buffer.from(
        imagePart.inlineData.data,
        "base64"
      ),
      mimeType: imagePart.inlineData.mimeType ?? "image/png",
    };
  } catch (error) {
    console.error("========== VERTEX ERROR ==========");
    console.error(error);

    if (error instanceof Error) {
      console.error("Name:", error.name);
      console.error("Message:", error.message);
      console.error("Stack:", error.stack);
    }

    console.error("==================================");

    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Vertex AI request failed.",
    };
  }
}
