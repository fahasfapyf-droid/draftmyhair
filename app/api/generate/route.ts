import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { ImageType } from "@prisma/client";

import { auth } from "@/auth";
import { generatePreview } from "@/lib/engine";
import { prisma } from "@/lib/prisma";
import {
  deleteFromStorage,
  uploadBufferToStorage,
} from "@/lib/storage";
import type { StorageUploadResult } from "@/lib/storage";

const MAX_UPLOAD_SIZE = 20 * 1024 * 1024; // 20 MB

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized.",
        },
        { status: 401 }
      );
    }

    const formData = await request.formData();

    const image = formData.get("image");
    const promptKey = formData.get("promptKey");

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

    if (image.size === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Image is empty.",
        },
        { status: 400 }
      );
    }

    // ============================================================
    // Convert File -> Buffer
    // ============================================================

    const arrayBuffer = await image.arrayBuffer();

    const imageBuffer = Buffer.from(arrayBuffer);

    // ============================================================
    // Persist Original Image
    // ============================================================

    let uploadedImage: StorageUploadResult;

    try {
      uploadedImage = await uploadBufferToStorage({
        buffer: imageBuffer,
        ownerId: session.user.id,
        folder: "originals",
        filename: `${randomUUID()}-${image.name}`,
        mimeType: image.type,
      });
    } catch (error) {
      console.error("Original image upload failed:", error);

      return NextResponse.json(
        {
          success: false,
          error: "Unable to store the original image.",
        },
        { status: 502 }
      );
    }

    try {
      await prisma.image.create({
        data: {
          ownerId: session.user.id,
          type: ImageType.ORIGINAL,
          storageKey: uploadedImage.storageKey,
          blobUrl: uploadedImage.blobUrl,
          originalFilename: image.name || null,
          mimeType: uploadedImage.mimeType,
          fileSize: uploadedImage.fileSize,
        },
      });
    } catch (error) {
      console.error("Original image record creation failed:", error);

      try {
        await deleteFromStorage({
          blobUrl: uploadedImage.blobUrl,
        });
      } catch (cleanupError) {
        console.error("Original image cleanup failed:", cleanupError);
      }

      return NextResponse.json(
        {
          success: false,
          error: "Unable to record the original image.",
        },
        { status: 500 }
      );
    }

    // ============================================================
    // Execute Generation Pipeline
    // ============================================================

    const result = await generatePreview({
      imageBuffer,
      mimeType: image.type,
      promptKey: promptKey.trim(),
      userId: session.user.id,
    });

    if (!result.success) {
      return NextResponse.json(result, {
        status: 400,
      });
    }

    const {
      imageBuffer: _imageBuffer,
      mimeType: _mimeType,
      ...response
    } = result;

    return NextResponse.json(response, {
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
