import { NextResponse } from "next/server";

import { generatePreview } from "@/lib/engine";

const MAX_UPLOAD_SIZE = 20 * 1024 * 1024; // 20 MB

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

export async function POST(request: Request) {
  try {
    const formData = await request.formData();

    const image = formData.get("image");
    const promptKey = formData.get("promptKey");
    const userId = formData.get("userId");

    // ============================================================
    // Validate Request
    // ============================================================

    if (!(image instanceof File)) {
      return NextResponse.json(
        {
          success: false,
          error: "Image is required.",
        },
        { status: 400 }
      );
    }

    if (
      typeof promptKey !== "string" ||
      promptKey.trim().length === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Hairstyle prompt key is required.",
        },
        { status: 400 }
      );
    }

    if (!ALLOWED_MIME_TYPES.includes(image.type)) {
      return NextResponse.json(
        {
          success: false,
          error: `Unsupported image format: ${image.type}`,
        },
        { status: 400 }
      );
    }

    if (image.size > MAX_UPLOAD_SIZE) {
      return NextResponse.json(
        {
          success: false,
          error: "Image exceeds the 20 MB upload limit.",
        },
        { status: 413 }
      );
    }

    // ============================================================
    // Convert File -> Buffer
    // ============================================================

    const arrayBuffer = await image.arrayBuffer();

    const imageBuffer = Buffer.from(arrayBuffer);

    // ============================================================
    // Execute Generation Pipeline
    // ============================================================

    const result = await generatePreview({
      imageBuffer,
      mimeType: image.type,
      promptKey: promptKey.trim(),
      userId:
        typeof userId === "string"
          ? userId
          : undefined,
    });

    if (!result.success) {
      return NextResponse.json(result, {
        status: 400,
      });
    }

    return NextResponse.json(result, {
      status: 200,
    });
  } catch (error) {
    console.error("Generation API Error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Internal Server Error",
      },
      {
        status: 500,
      }
    );
  }
}