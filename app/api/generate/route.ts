import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import {
  GenerationStatus,
  ImageType,
} from "@prisma/client";

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

    const normalizedPromptKey = promptKey.trim();

    const hairstyle = await prisma.hairstyle.findUnique({
      where: {
        promptKey: normalizedPromptKey,
      },
      select: {
        id: true,
      },
    });

    if (!hairstyle) {
      return NextResponse.json(
        {
          success: false,
          error: "Hairstyle not found.",
        },
        { status: 404 }
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

    let originalImage: { id: string };

    try {
      originalImage = await prisma.image.create({
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

    const generationStartedAt = new Date();

    const result = await generatePreview({
      imageBuffer,
      mimeType: image.type,
      promptKey: normalizedPromptKey,
      userId: session.user.id,
    });

    const generationCompletedAt = new Date();

if (!result.success) {
  try {
    await prisma.image.delete({
      where: {
        id: originalImage.id,
      },
    });
  } catch (cleanupError) {
    console.error(
      "Failed to delete original image record:",
      cleanupError
    );
  }

  try {
    await deleteFromStorage({
      blobUrl: uploadedImage.blobUrl,
    });
  } catch (cleanupError) {
    console.error(
      "Failed to delete original blob:",
      cleanupError
    );
  }

  return NextResponse.json(result, {
    status: 400,
  });
}

    if (
      !result.imageBuffer ||
      !result.mimeType ||
      !result.generationId ||
      !result.imageUrl ||
      !result.promptVersion ||
      !result.provider ||
      !result.providerModel
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Generation returned incomplete image data.",
        },
        { status: 500 }
      );
    }

    const {
      imageBuffer: generatedImageBuffer,
      mimeType: generatedImageMimeType,
      generationId: engineGenerationId,
      imageUrl: engineImageUrl,
      promptVersion,
      provider,
      providerModel,
    } = result;

    // ============================================================
    // Persist Generated Image
    // ============================================================

    let uploadedGeneratedImage: StorageUploadResult;

    try {
      uploadedGeneratedImage = await uploadBufferToStorage({
        buffer: generatedImageBuffer,
        ownerId: session.user.id,
        folder: "generated-images",
        filename: engineGenerationId,
        mimeType: generatedImageMimeType,
      });
    } catch (error) {
      console.error("Generated image upload failed:", error);

      return NextResponse.json(
        {
          success: false,
          error: "Unable to store the generated image.",
        },
        { status: 502 }
      );
    }

    let generatedImage: { id: string };

    try {
      generatedImage = await prisma.image.create({
        data: {
          ownerId: session.user.id,
          type: ImageType.GENERATED,
          storageKey: uploadedGeneratedImage.storageKey,
          blobUrl: uploadedGeneratedImage.blobUrl,
          mimeType: uploadedGeneratedImage.mimeType,
          fileSize: uploadedGeneratedImage.fileSize,
        },
      });
    } catch (error) {
      console.error("Generated image record creation failed:", error);

      try {
        await deleteFromStorage({
          blobUrl: uploadedGeneratedImage.blobUrl,
        });
      } catch (cleanupError) {
        console.error("Generated image cleanup failed:", cleanupError);
      }

      return NextResponse.json(
        {
          success: false,
          error: "Unable to record the generated image.",
        },
        { status: 500 }
      );
    }

    // ============================================================
    // Persist Generation and Link Images
    // ============================================================

    let generation: { id: string };

    try {
      generation = await prisma.$transaction(async (tx) => {
        const createdGeneration = await tx.generation.create({
          data: {
            userId: session.user.id,
            hairstyleId: hairstyle.id,
            status: GenerationStatus.COMPLETED,
            promptKey: normalizedPromptKey,
            promptVersion,
            provider,
            providerModel,
            inputImageUrl: uploadedImage.blobUrl,
            outputImageUrl: uploadedGeneratedImage.blobUrl,
            sourceStorageKey: uploadedImage.storageKey,
            resultStorageKey: uploadedGeneratedImage.storageKey,
            processingStartedAt: generationStartedAt,
            completedAt: generationCompletedAt,
            processingTimeMs:
              generationCompletedAt.getTime() -
              generationStartedAt.getTime(),
          },
        });

        await tx.image.update({
          where: {
            id: originalImage.id,
          },
          data: {
            generationId: createdGeneration.id,
          },
        });

        await tx.image.update({
          where: {
            id: generatedImage.id,
          },
          data: {
            generationId: createdGeneration.id,
          },
        });

        return createdGeneration;
      });
    } catch (error) {
  console.error("Generation persistence failed:", error);

  try {
    await prisma.image.delete({
      where: {
        id: generatedImage.id,
      },
    });
  } catch (cleanupError) {
    console.error(
      "Failed to delete generated image record:",
      cleanupError
    );
  }

  try {
    await prisma.image.delete({
      where: {
        id: originalImage.id,
      },
    });
  } catch (cleanupError) {
    console.error(
      "Failed to delete original image record:",
      cleanupError
    );
  }

  try {
    await deleteFromStorage({
      blobUrl: uploadedGeneratedImage.blobUrl,
    });
  } catch (cleanupError) {
    console.error(
      "Failed to delete generated blob:",
      cleanupError
    );
  }

  try {
    await deleteFromStorage({
      blobUrl: uploadedImage.blobUrl,
    });
  } catch (cleanupError) {
    console.error(
      "Failed to delete original blob:",
      cleanupError
    );
  }

  return NextResponse.json(
    {
      success: false,
      error: "Unable to persist the generation.",
    },
    {
      status: 500,
    }
  );
}

    return NextResponse.json(
  {
    success: true,
    imageUrl: `/api/blob?pathname=${encodeURIComponent(
      uploadedGeneratedImage.storageKey
    )}`,
    generationId: generation.id,
  },
  {
    status: 200,
  }
);
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
