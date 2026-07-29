import { GoogleGenAI } from "@google/genai";

import {
  ProviderGenerationRequest,
  ProviderGenerationResult,
} from "../types";

const ai = new GoogleGenAI({
  vertexai: true,
  project: process.env.GOOGLE_CLOUD_PROJECT_ID!,
  location: process.env.GOOGLE_CLOUD_LOCATION!,
});

export async function generateWithVertex(
  request: ProviderGenerationRequest
): Promise<ProviderGenerationResult> {
  try {
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

    const imagePart = response.candidates?.[0]?.content?.parts?.find(
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
      providerModel: "gemini-3-pro-image-preview",
      imageBuffer: Buffer.from(imagePart.inlineData.data, "base64"),
      mimeType: imagePart.inlineData.mimeType ?? "image/png",
    };
  } catch (error) {
    console.error("Vertex Provider Error:", error);

    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Vertex AI request failed.",
    };
  }
}