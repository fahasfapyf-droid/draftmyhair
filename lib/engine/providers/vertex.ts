import { GoogleGenAI } from "@google/genai";

import {
  ProviderGenerationRequest,
  ProviderGenerationResult,
} from "../types";

export const VERTEX_PROVIDER = "vertex";
export const VERTEX_MODEL = "gemini-3-pro-image";

/**
 * Lazily create the Vertex AI client.
 * Prevents initialization during module import.
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

    // ==========================================================
    // DEBUG: VERIFY WHAT IS ACTUALLY SENT TO GEMINI
    // ==========================================================

    console.log("");
    console.log("==========================================================");
    console.log("           DRAFT MY HAIR → GEMINI REQUEST");
    console.log("==========================================================");

    console.log("Model:");
    console.log(VERTEX_MODEL);

    console.log("");

    console.log("Prompt Length:");
    console.log(request.prompt.length);

    console.log("");

    console.log("Prompt Start (first 1000 chars)");
    console.log("--------------------------------");
    console.log(request.prompt.substring(0, 1000));

    console.log("");

    console.log("Prompt End (last 1000 chars)");
    console.log("------------------------------");
    console.log(
      request.prompt.substring(
        Math.max(0, request.prompt.length - 1000)
      )
    );

    console.log("");

    console.log("Image");
    console.log("--------------------------------");
    console.log("Mime Type:", request.mimeType);

console.log(
  "Image Size:",
  request.imageBuffer.length,
  "bytes"
);

console.log(
  "Width:",
  request.metadata.width
);

console.log(
  "Height:",
  request.metadata.height
);

console.log(
  "Orientation:",
  request.metadata.orientation ?? "None"
);

console.log(
  "Aspect Ratio:",
  request.metadata.aspectRatio
);

    console.log("");

    console.log("Prompt Hash");
    console.log("--------------------------------");
    console.log(
      Buffer.from(request.prompt)
        .toString("base64")
        .substring(0, 120)
    );

    console.log("==========================================================");
    console.log("");

    // ==========================================================
    // SEND REQUEST
    // ==========================================================

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

    console.log("✓ Gemini returned an image successfully.");

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
    console.error("");
    console.error("==========================================================");
    console.error("                 VERTEX ERROR");
    console.error("==========================================================");

    console.error(error);

    if (error instanceof Error) {
      console.error("");
      console.error("Name:");
      console.error(error.name);

      console.error("");
      console.error("Message:");
      console.error(error.message);

      console.error("");
      console.error("Stack:");
      console.error(error.stack);
    }

    console.error("==========================================================");

    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Vertex AI request failed.",
    };
  }
}