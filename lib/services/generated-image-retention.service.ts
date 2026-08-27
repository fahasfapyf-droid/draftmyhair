import { GenerationStatus, ImageStatus, ImageType } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { deleteFromStorage } from "@/lib/storage";

const GENERATED_IMAGE_RETENTION_DAYS = 7;
const RETENTION_BATCH_SIZE = 100;

export type GeneratedImageRetentionSummary = {
  eligible: number;
  deleted: number;
  failed: number;
};

function retentionCutoff() {
  return new Date(
    Date.now() - GENERATED_IMAGE_RETENTION_DAYS * 24 * 60 * 60 * 1000
  );
}

/**
 * Deletes generated preview blobs once they are more than seven days old.
 *
 * Feedback is intentionally preserved: feedback belongs to the Generation
 * record, while this sweep only removes the generated Image/blob and clears
 * the generation's result pointers so expired results cannot be downloaded.
 */
export async function expireOldGeneratedImages(): Promise<GeneratedImageRetentionSummary> {
  const candidates = await prisma.image.findMany({
    where: {
      type: ImageType.GENERATED,
      status: ImageStatus.ACTIVE,
      generation: {
        status: GenerationStatus.COMPLETED,
        completedAt: {
          not: null,
          lt: retentionCutoff(),
        },
      },
    },
    select: {
      id: true,
      blobUrl: true,
      generationId: true,
    },
    orderBy: { createdAt: "asc" },
    take: RETENTION_BATCH_SIZE,
  });

  let deleted = 0;
  let failed = 0;

  for (const image of candidates) {
    try {
      await deleteFromStorage({ blobUrl: image.blobUrl });

      await prisma.$transaction(async (tx) => {
        await tx.image.update({
          where: { id: image.id },
          data: { status: ImageStatus.DELETED },
        });

        if (image.generationId) {
          await tx.generation.update({
            where: { id: image.generationId },
            data: {
              outputImageUrl: null,
              resultStorageKey: null,
            },
          });
        }
      });

      deleted += 1;
    } catch (error) {
      failed += 1;
      console.error(`Generated image retention cleanup failed for ${image.id}:`, error);
    }
  }

  return {
    eligible: candidates.length,
    deleted,
    failed,
  };
}
