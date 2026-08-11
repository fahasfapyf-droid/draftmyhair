import { GenerationStatus, ImageType } from "@prisma/client";
import { getImageMetadata } from "@/lib/image/metadata";
import { generatePreview, getGenerationMetadata } from "@/lib/engine";
import { prisma } from "@/lib/prisma";
import {
  completeGeneration,
  createQueuedGeneration,
  failGeneration,
  markGenerationProcessing,
} from "@/lib/services/generation-lifecycle.service";
import type { StorageUploadResult } from "@/lib/storage";
import { uploadBufferToStorage } from "@/lib/storage";

const MAX_GENERATION_RETRIES = 3;
const RETRY_DELAYS_MS = [1000, 2000, 4000];

function delay(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function isRetryableGenerationError(error: unknown) {
  const message =
    error instanceof Error
      ? error.message.toLowerCase()
      : String(error).toLowerCase();

  const retryablePatterns = [
    "timeout",
    "timed out",
    "deadline",
    "429",
    "500",
    "502",
    "503",
    "504",
    "network",
    "connection",
    "unavailable",
    "temporarily",
    "internal server error",
  ];

  return retryablePatterns.some((pattern) => message.includes(pattern));
}

async function generatePreviewWithRetry(
  args: Parameters<typeof generatePreview>[0]
) {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_GENERATION_RETRIES; attempt++) {
    try {
      return await generatePreview(args);
    } catch (error) {
      lastError = error;

      const shouldRetry =
        attempt < MAX_GENERATION_RETRIES &&
        isRetryableGenerationError(error);

      if (!shouldRetry) {
        throw error;
      }

      console.warn(`Generation attempt ${attempt} failed. Retrying...`);
      await delay(RETRY_DELAYS_MS[attempt - 1]);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Generation failed.");
}

export type GeneratePreviewJob = {
  generationId: string;
  sourceImage: {
    buffer: Buffer;
    mimeType: string;
  };
};

export type PrepareGeneratePreviewJobInput = {
  generationId: string;
  userId: string;
  promptKey: string;
  imageBuffer: Buffer;
  mimeType: string;
  originalFilename: string;
};

export type GenerationExecutionFailure = {
  ok: false;
  error: string;
  status: number;
  refundDescription?: string;
};

export type GenerationExecutionSuccess = {
  ok: true;
  generationId: string;
  imageUrl: string;
};

export type GenerationExecutionResult =
  | GenerationExecutionFailure
  | GenerationExecutionSuccess;

type JobPreparationResult =
  | { ok: true; job: GeneratePreviewJob }
  | GenerationExecutionFailure;

export async function prepareGeneratePreviewJob(
  input: PrepareGeneratePreviewJobInput
): Promise<JobPreparationResult> {
  const hairstyle = await prisma.hairstyle.findFirst({
    where: { promptKey: input.promptKey, isActive: true },
    select: { id: true },
  });

  if (!hairstyle) {
    return {
      ok: false,
      error: "Hairstyle not found or is no longer available.",
      status: 404,
      refundDescription: "Hairstyle prompt key is unavailable",
    };
  }

  // The API route already normalizes the uploaded image. Keep the normalized
  // bytes in memory for this synchronous job instead of writing the original
  // image to Blob and reading it back. This removes one Blob PUT and one Blob
  // GET from every generation while preserving the exact model input bytes.
  try {
    const generation = await createQueuedGeneration({
      generationId: input.generationId,
      userId: input.userId,
      hairstyleId: hairstyle.id,
      promptKey: input.promptKey,
      ...getGenerationMetadata(),
    });

    return {
      ok: true,
      job: {
        generationId: generation.id,
        sourceImage: {
          buffer: input.imageBuffer,
          mimeType: input.mimeType,
        },
      },
    };
  } catch (error) {
    console.error("Queued generation creation failed:", error);

    return {
      ok: false,
      error: "Unable to start the generation.",
      status: 500,
      refundDescription: "Generation persistence failed",
    };
  }
}

async function cleanupGeneratedImage(
  generatedImageId: string,
  uploadedImage: StorageUploadResult
) {
  try {
    await prisma.image.delete({ where: { id: generatedImageId } });
  } catch (error) {
    console.error("Generated image record cleanup failed:", error);
  }

  try {
    const { deleteFromStorage } = await import("@/lib/storage");
    await deleteFromStorage({ blobUrl: uploadedImage.blobUrl });
  } catch (error) {
    console.error("Generated image blob cleanup failed:", error);
  }
}

async function markJobFailed(
  generationId: string,
  errorMessage: string,
  processingStartedAt?: Date
) {
  try {
    await failGeneration(generationId, errorMessage, processingStartedAt);
  } catch (error) {
    console.error("Failed to mark generation as failed:", error);
  }
}

export async function executeGeneratePreviewJob(
  job: GeneratePreviewJob
): Promise<GenerationExecutionResult> {
  const generation = await prisma.generation.findUnique({
    where: { id: job.generationId },
    select: {
      userId: true,
      promptKey: true,
      status: true,
    },
  });

  if (!generation) {
    return {
      ok: false,
      error: "Generation not found.",
      status: 404,
      refundDescription: "Generation record not found",
    };
  }

  if (generation.status !== GenerationStatus.QUEUED) {
    return {
      ok: false,
      error: "Generation is already being processed or has finished.",
      status: 409,
      refundDescription: "Generation was already processed",
    };
  }

  // The source image is intentionally held in memory for this synchronous
  // execution path. Persistent Blob storage is reserved for generated results.
  const sourceImage = job.sourceImage;
  const metadata = await getImageMetadata(sourceImage.buffer);

  let processingStartedAt: Date;

  try {
    processingStartedAt = await markGenerationProcessing(job.generationId);
  } catch (error) {
    console.error("Generation processing transition failed:", error);

    const latestGeneration = await prisma.generation.findUnique({
      where: { id: job.generationId },
      select: { status: true },
    });

    if (
      latestGeneration?.status === GenerationStatus.PROCESSING ||
      latestGeneration?.status === GenerationStatus.COMPLETED
    ) {
      return {
        ok: false,
        error: "Generation is already being processed.",
        status: 409,
        refundDescription: "Generation was already processed",
      };
    }

    await markJobFailed(
      job.generationId,
      "Unable to start generation processing."
    );

    return {
      ok: false,
      error: "Unable to start the generation.",
      status: 500,
      refundDescription: "Generation processing transition failed",
    };
  }

  try {
    const result = await generatePreviewWithRetry({
      imageBuffer: sourceImage.buffer,
      mimeType: sourceImage.mimeType,
      metadata,
      promptKey: generation.promptKey,
      userId: generation.userId,
    });

    if (!result.success) {
      await markJobFailed(
        job.generationId,
        result.error ?? "Generation failed.",
        processingStartedAt
      );
      return {
        ok: false,
        error: result.error ?? "Generation failed.",
        status: 400,
        refundDescription: "Generation failed",
      };
    }

    if (!result.imageBuffer || !result.mimeType || !result.generationId) {
      await markJobFailed(
        job.generationId,
        "Generation returned incomplete image data.",
        processingStartedAt
      );
      return {
        ok: false,
        error: "Generation returned incomplete image data.",
        status: 500,
        refundDescription: "Generation returned incomplete image data",
      };
    }

    let uploadedGeneratedImage: StorageUploadResult;

    try {
      uploadedGeneratedImage = await uploadBufferToStorage({
        buffer: result.imageBuffer,
        ownerId: generation.userId,
        folder: "generated-images",
        filename: result.generationId,
        mimeType: result.mimeType,
      });
    } catch (error) {
      console.error("Generated image upload failed:", error);
      await markJobFailed(
        job.generationId,
        "Unable to store the generated image.",
        processingStartedAt
      );
      return {
        ok: false,
        error: "Unable to store the generated image.",
        status: 502,
        refundDescription: "Generated image upload failed",
      };
    }

    let generatedImage: { id: string };

    try {
      generatedImage = await prisma.image.create({
        data: {
          ownerId: generation.userId,
          type: ImageType.GENERATED,
          storageKey: uploadedGeneratedImage.storageKey,
          blobUrl: uploadedGeneratedImage.blobUrl,
          mimeType: uploadedGeneratedImage.mimeType,
          fileSize: uploadedGeneratedImage.fileSize,
        },
        select: { id: true },
      });
    } catch (error) {
      console.error("Generated image record creation failed:", error);
      await markJobFailed(
        job.generationId,
        "Unable to record the generated image.",
        processingStartedAt
      );

      try {
        const { deleteFromStorage } = await import("@/lib/storage");
        await deleteFromStorage({ blobUrl: uploadedGeneratedImage.blobUrl });
      } catch (cleanupError) {
        console.error("Generated image cleanup failed:", cleanupError);
      }

      return {
        ok: false,
        error: "Unable to record the generated image.",
        status: 500,
        refundDescription: "Generated image record creation failed",
      };
    }

    try {
      await completeGeneration({
        generationId: job.generationId,
        generatedImageId: generatedImage.id,
        outputImageUrl: uploadedGeneratedImage.blobUrl,
        resultStorageKey: uploadedGeneratedImage.storageKey,
        processingStartedAt,
      });
    } catch (error) {
      console.error("Generation completion failed:", error);
      await markJobFailed(
        job.generationId,
        "Unable to complete the generation.",
        processingStartedAt
      );
      await cleanupGeneratedImage(generatedImage.id, uploadedGeneratedImage);

      return {
        ok: false,
        error: "Unable to persist the generation.",
        status: 500,
        refundDescription: "Generation persistence failed",
      };
    }

    return {
      ok: true,
      generationId: job.generationId,
      imageUrl: `/api/blob?pathname=${encodeURIComponent(
        uploadedGeneratedImage.storageKey
      )}`,
    };
  } catch (error) {
    console.error("Generation execution failed:", error);
    await markJobFailed(
      job.generationId,
      "Unexpected generation error.",
      processingStartedAt
    );

    return {
      ok: false,
      error: "Internal Server Error",
      status: 500,
      refundDescription: "Unexpected generation error",
    };
  }
}
