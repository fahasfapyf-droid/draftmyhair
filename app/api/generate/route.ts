import { randomUUID } from "crypto";
import { ImageType } from "@prisma/client";
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { generatePreview, getGenerationMetadata } from "@/lib/engine";
import { prisma } from "@/lib/prisma";
import {
  completeGeneration,
  createQueuedGeneration,
  failGeneration,
  markGenerationProcessing,
} from "@/lib/services/generation-lifecycle.service";
import {
  consumeCredits,
  refundCredits,
} from "@/lib/services/credit.service";
import {
  deleteFromStorage,
  uploadBufferToStorage,
} from "@/lib/storage";
import type { StorageUploadResult } from "@/lib/storage";

const MAX_UPLOAD_SIZE = 20 * 1024 * 1024;
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

export async function POST(request: Request) {
  let creditsConsumed = false;
  let userId: string | undefined;
  let generationId: string | undefined;
  let processingStartedAt: Date | undefined;

  const refundIfNeeded = async (description: string) => {
    if (!creditsConsumed || !userId) {
      return;
    }

    try {
      await refundCredits({
        userId,
        description,
      });

      creditsConsumed = false;
    } catch (error) {
      console.error("Failed to refund credits:", error);
    }
  };

  const markFailed = async (errorMessage: string) => {
    if (!generationId) {
      return;
    }

    try {
      await failGeneration(
        generationId,
        errorMessage,
        processingStartedAt
      );
    } catch (error) {
      console.error("Failed to mark generation as failed:", error);
    }
  };

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

    userId = session.user.id;

    try {
      await consumeCredits({
        userId,
        amount: 1,
        description: "AI hairstyle generation",
      });

      creditsConsumed = true;
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Unable to consume credits.",
        },
        { status: 402 }
      );
    }

    const formData = await request.formData();
    const image = formData.get("image");
    const promptKey = formData.get("promptKey");

    if (!(image instanceof File)) {
      return NextResponse.json(
        {
          success: false,
          error: "Image is required.",
        },
        { status: 400 }
      );
    }

    if (typeof promptKey !== "string" || promptKey.trim().length === 0) {
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

    const imageBuffer = Buffer.from(await image.arrayBuffer());

    let uploadedImage: StorageUploadResult;

    try {
      uploadedImage = await uploadBufferToStorage({
        buffer: imageBuffer,
        ownerId: userId,
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
          ownerId: userId,
          type: ImageType.ORIGINAL,
          storageKey: uploadedImage.storageKey,
          blobUrl: uploadedImage.blobUrl,
          originalFilename: image.name || null,
          mimeType: uploadedImage.mimeType,
          fileSize: uploadedImage.fileSize,
        },
        select: {
          id: true,
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

    try {
      const metadata = getGenerationMetadata();
      const generation = await createQueuedGeneration({
        userId,
        hairstyleId: hairstyle.id,
        promptKey: normalizedPromptKey,
        inputImageUrl: uploadedImage.blobUrl,
        sourceStorageKey: uploadedImage.storageKey,
        originalImageId: originalImage.id,
        ...metadata,
      });

      generationId = generation.id;
    } catch (error) {
      console.error("Queued generation creation failed:", error);
      await refundIfNeeded("Generation persistence failed");

      try {
        await prisma.image.delete({
          where: {
            id: originalImage.id,
          },
        });
        await deleteFromStorage({
          blobUrl: uploadedImage.blobUrl,
        });
      } catch (cleanupError) {
        console.error("Original image cleanup failed:", cleanupError);
      }

      return NextResponse.json(
        {
          success: false,
          error: "Unable to start the generation.",
        },
        { status: 500 }
      );
    }

    try {
      processingStartedAt = await markGenerationProcessing(generationId);
    } catch (error) {
      console.error("Generation processing transition failed:", error);
      await markFailed("Unable to start generation processing.");
      await refundIfNeeded("Generation processing transition failed");

      return NextResponse.json(
        {
          success: false,
          error: "Unable to start the generation.",
        },
        { status: 500 }
      );
    }

    const result = await generatePreview({
      imageBuffer,
      mimeType: image.type,
      promptKey: normalizedPromptKey,
      userId,
    });

    if (!result.success) {
      await markFailed(result.error ?? "Generation failed.");
      await refundIfNeeded("Generation failed");

      return NextResponse.json(result, {
        status: 400,
      });
    }

    if (!result.imageBuffer || !result.mimeType || !result.generationId) {
      await markFailed("Generation returned incomplete image data.");
      await refundIfNeeded("Generation returned incomplete image data");

      return NextResponse.json(
        {
          success: false,
          error: "Generation returned incomplete image data.",
        },
        { status: 500 }
      );
    }

    let uploadedGeneratedImage: StorageUploadResult;

    try {
      uploadedGeneratedImage = await uploadBufferToStorage({
        buffer: result.imageBuffer,
        ownerId: userId,
        folder: "generated-images",
        filename: result.generationId,
        mimeType: result.mimeType,
      });
    } catch (error) {
      console.error("Generated image upload failed:", error);
      await markFailed("Unable to store the generated image.");
      await refundIfNeeded("Generated image upload failed");

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
          ownerId: userId,
          type: ImageType.GENERATED,
          storageKey: uploadedGeneratedImage.storageKey,
          blobUrl: uploadedGeneratedImage.blobUrl,
          mimeType: uploadedGeneratedImage.mimeType,
          fileSize: uploadedGeneratedImage.fileSize,
        },
        select: {
          id: true,
        },
      });
    } catch (error) {
      console.error("Generated image record creation failed:", error);
      await markFailed("Unable to record the generated image.");
      await refundIfNeeded("Generated image record creation failed");

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

    try {
      await completeGeneration({
        generationId,
        generatedImageId: generatedImage.id,
        outputImageUrl: uploadedGeneratedImage.blobUrl,
        resultStorageKey: uploadedGeneratedImage.storageKey,
        processingStartedAt,
      });
    } catch (error) {
      console.error("Generation completion failed:", error);
      await markFailed("Unable to complete the generation.");
      await refundIfNeeded("Generation persistence failed");

      try {
        await prisma.image.delete({
          where: {
            id: generatedImage.id,
          },
        });
        await deleteFromStorage({
          blobUrl: uploadedGeneratedImage.blobUrl,
        });
      } catch (cleanupError) {
        console.error("Generated image cleanup failed:", cleanupError);
      }

      return NextResponse.json(
        {
          success: false,
          error: "Unable to persist the generation.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        imageUrl: `/api/blob?pathname=${encodeURIComponent(
          uploadedGeneratedImage.storageKey
        )}`,
        generationId,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Generation API Error:", error);
    await markFailed("Unexpected generation error.");

    return NextResponse.json(
      {
        success: false,
        error: "Internal Server Error",
      },
      { status: 500 }
    );
  }
}
