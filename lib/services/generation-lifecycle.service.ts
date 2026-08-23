import { GenerationStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";

type GenerationMetadata = {
  promptVersion: string;
  provider: string;
  providerModel: string;
};

type CreateQueuedGenerationInput = GenerationMetadata & {
  generationId: string;
  userId: string;
  hairstyleId: string;
  promptKey: string;
};

export async function createQueuedGeneration({
  generationId,
  ...data
}: CreateQueuedGenerationInput) {
  return prisma.generation.create({
    data: {
      id: generationId,
      ...data,
      status: GenerationStatus.QUEUED,
    },
    select: {
      id: true,
    },
  });
}

export async function deleteQueuedGeneration(
  generationId: string,
  userId: string
) {
  await prisma.generation.deleteMany({
    where: {
      id: generationId,
      userId,
      status: GenerationStatus.QUEUED,
    },
  });
}

export async function markGenerationProcessing(generationId: string) {
  const processingStartedAt = new Date();

  const transition = await prisma.generation.updateMany({
    where: {
      id: generationId,
      status: GenerationStatus.QUEUED,
    },
    data: {
      status: GenerationStatus.PROCESSING,
      processingStartedAt,
      errorMessage: null,
    },
  });

  if (transition.count !== 1) {
    throw new Error("Generation could not transition to processing.");
  }

  return processingStartedAt;
}

/**
 * Atomically records one actual provider call for the existing generation.
 * Stored in the existing metadata JSON so no schema migration is required
 * and the generation lifecycle remains unchanged.
 */
export async function incrementProviderAttempts(generationId: string) {
  const result = await prisma.$executeRaw`
    UPDATE "Generation"
    SET "metadata" = jsonb_set(
      COALESCE("metadata", '{}'::jsonb),
      '{providerAttempts}',
      to_jsonb(COALESCE(NULLIF("metadata"->>'providerAttempts', '')::integer, 0) + 1),
      true
    )
    WHERE "id" = ${generationId}
  `;

  if (result !== 1) {
    throw new Error("Generation provider attempt could not be recorded.");
  }
}

type CompleteGenerationInput = {
  generationId: string;
  generatedImageId: string;
  outputImageUrl: string;
  resultStorageKey: string;
  processingStartedAt: Date;
};

export async function completeGeneration({
  generationId,
  generatedImageId,
  outputImageUrl,
  resultStorageKey,
  processingStartedAt,
}: CompleteGenerationInput) {
  const completedAt = new Date();

  return prisma.$transaction(async (tx) => {
    const transition = await tx.generation.updateMany({
      where: {
        id: generationId,
        status: GenerationStatus.PROCESSING,
      },
      data: {
        status: GenerationStatus.COMPLETED,
        outputImageUrl,
        resultStorageKey,
        completedAt,
        processingTimeMs:
          completedAt.getTime() - processingStartedAt.getTime(),
        errorMessage: null,
      },
    });

    if (transition.count !== 1) {
      throw new Error("Generation could not transition to completed.");
    }

    await tx.image.update({
      where: {
        id: generatedImageId,
      },
      data: {
        generationId,
      },
    });

    return {
      id: generationId,
    };
  });
}

export async function failGeneration(
  generationId: string,
  errorMessage: string,
  processingStartedAt?: Date
) {
  const completedAt = new Date();

  const transition = await prisma.generation.updateMany({
    where: {
      id: generationId,
      status: {
        in: [GenerationStatus.QUEUED, GenerationStatus.PROCESSING],
      },
    },
    data: {
      status: GenerationStatus.FAILED,
      errorMessage,
      completedAt,
      ...(processingStartedAt
        ? {
            processingTimeMs:
              completedAt.getTime() - processingStartedAt.getTime(),
          }
        : {}),
    },
  });

  if (transition.count !== 1) {
    throw new Error("Generation could not transition to failed.");
  }
}
