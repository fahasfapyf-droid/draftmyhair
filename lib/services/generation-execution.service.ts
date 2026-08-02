import { randomUUID } from "crypto";
import { GenerationStatus, ImageType } from "@prisma/client";

import { generatePreview, getGenerationMetadata } from "@/lib/engine";
import { prisma } from "@/lib/prisma";
import {
  completeGeneration,
  createQueuedGeneration,
  failGeneration,
  markGenerationProcessing,
} from "@/lib/services/generation-lifecycle.service";
import {
  deleteFromStorage,
  readBufferFromStorage,
  uploadBufferToStorage,
} from "@/lib/storage";
import type { StorageUploadResult } from "@/lib/storage";

export type GeneratePreviewJob = {
  generationId: string;
};

export type PrepareGeneratePreviewJobInput = {
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
  | {
      ok: true;
      job: GeneratePreviewJob;
    }
  | GenerationExecutionFailure;

async function cleanupOriginalImage(
  originalImageId: string,
  uploadedImage: StorageUploadResult
) {
  try {
    await prisma.image.delete({
      where: {
        id: originalImageId,
      },
    });
  } catch (error) {
    console.error("Original image record cleanup failed:", error);
  }

  try {
    await deleteFromStorage({
      blobUrl: uploadedImage.blobUrl,
    });
  } catch (error) {
    console.error("Original image blob cleanup failed:", error);
  }
}

async function cleanupGeneratedImage(
  generatedImageId: string,
  uploadedImage: StorageUploadResult
) {
  try {
    await prisma.image.delete({
      where: {
        id: generatedImageId,
      },
    });
  } catch (error) {
    console.error("Generated image record cleanup failed:", error);
  }

  try {
    await deleteFromStorage({
      blobUrl: uploadedImage.blobUrl,
    });
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

export async function prepareGeneratePreviewJob(
  input: PrepareGeneratePreviewJobInput
): Promise<JobPreparationResult> {
  const hairstyle = await prisma.hairstyle.findUnique({
    where: {
      promptKey: input.promptKey,
    },
    select: {
      id: true,
    },
  });

  if (!hairstyle) {
    return {
      ok: false,
      error: "Hairstyle not found.",
      status: 404,
    };
  }

  let uploadedImage: StorageUploadResult;

  try {
    uploadedImage = await uploadBufferToStorage({
      buffer: input.imageBuffer,
      ownerId: input.userId,
      folder: "originals",
      filename: `${randomUUID()}-${input.originalFilename}`,
      mimeType: input.mimeType,
    });
  } catch (error) {
    console.error("Original image upload failed:", error);

    return {
      ok: false,
      error: "Unable to store the original image.",
      status: 502,
    };
  }

  let originalImage: { id: string };

  try {
    originalImage = await prisma.image.create({
      data: {
        ownerId: input.userId,
        type: ImageType.ORIGINAL,
        storageKey: uploadedImage.storageKey,
        blobUrl: uploadedImage.blobUrl,
        originalFilename: input.originalFilename || null,
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

    return {
      ok: false,
      error: "Unable to record the original image.",
      status: 500,
    };
  }

  try {
    const generation = await createQueuedGeneration({
      userId: input.userId,
      hairstyleId: hairstyle.id,
      promptKey: input.promptKey,
      inputImageUrl: uploadedImage.blobUrl,
      sourceStorageKey: uploadedImage.storageKey,
      originalImageId: originalImage.id,
      ...getGenerationMetadata(),
    });

    return {
      ok: true,
      job: {
        generationId: generation.id,
      },
    };
  } catch (error) {
    console.error("Queued generation creation failed:", error);
    await cleanupOriginalImage(originalImage.id, uploadedImage);

    return {
      ok: false,
      error: "Unable to start the generation.",
      status: 500,
      refundDescription: "Generation persistence failed",
    };
  }
}

export async function executeGeneratePreviewJob(
  job: GeneratePreviewJob
): Promise<GenerationExecutionResult> {
  const generation = await prisma.generation.findUnique({
    where: {
      id: job.generationId,
    },
    select: {
      userId: true,
      promptKey: true,
      sourceStorageKey: true,
      status: true,
    },
  });

  if (!generation) {
    return {
      ok: false,
      error: "Generation not found.",
      status: 404,
    };
  }

  if (generation.status !== GenerationStatus.QUEUED) {
    return {
      ok: false,
      error: "Generation is already being processed or has finished.",
      status: 409,
    };
  }

  if (!generation.sourceStorageKey) {
    await markJobFailed(
      job.generationId,
      "Original image data is unavailable."
    );

    return {
      ok: false,
      error: "Unable to load the original image.",
      status: 500,
      refundDescription: "Original image data is unavailable",
    };
  }

  let sourceImage: Awaited<ReturnType<typeof readBufferFromStorage>>;

  try {
    sourceImage = await readBufferFromStorage(generation.sourceStorageKey);
  } catch (error) {
    console.error("Original image read failed:", error);
    await markJobFailed(job.generationId, "Unable to load the original image.");

    return {
      ok: false,
      error: "Unable to load the original image.",
      status: 502,
      refundDescription: "Original image read failed",
    };
  }

  if (!sourceImage) {
    await markJobFailed(job.generationId, "Original image is unavailable.");

    return {
      ok: false,
      error: "Unable to load the original image.",
      status: 500,
      refundDescription: "Original image is unavailable",
    };
  }

  let processingStartedAt: Date;

  try {
    processingStartedAt = await markGenerationProcessing(job.generationId);
  } catch (error) {
    console.error("Generation processing transition failed:", error);
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
    const result = await generatePreview({
      imageBuffer: sourceImage.buffer,
      mimeType: sourceImage.mimeType,
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
        select: {
          id: true,
        },
      });
    } catch (error) {
      console.error("Generated image record creation failed:", error);
      await markJobFailed(
        job.generationId,
        "Unable to record the generated image.",
        processingStartedAt
      );

      try {
        await deleteFromStorage({
          blobUrl: uploadedGeneratedImage.blobUrl,
        });
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
