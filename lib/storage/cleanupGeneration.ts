import { GenerationStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { refundCredits } from "@/lib/services/credit.service";
import { deleteFromStorage } from "@/lib/storage";

const REFUNDABLE_STATUSES = [
  GenerationStatus.QUEUED,
  GenerationStatus.PROCESSING,
  GenerationStatus.FAILED,
  GenerationStatus.CANCELLED,
];

export async function cleanupGeneration(
  generationId: string
): Promise<void> {
  const prepared = await prisma.$transaction(
    async (tx) => {
      const generation = await tx.generation.findUnique({
        where: { id: generationId },
        include: { images: true },
      });

      if (!generation) return null;

      if (
        generation.status === GenerationStatus.QUEUED ||
        generation.status === GenerationStatus.PROCESSING ||
        generation.status === GenerationStatus.FAILED
      ) {
        await tx.generation.update({
          where: { id: generationId },
          data: {
            status: GenerationStatus.CANCELLED,
            errorMessage: "Generation deleted by user.",
          },
        });
      } else if (generation.status !== GenerationStatus.CANCELLED) {
        return null;
      }

      return {
        userId: generation.userId,
        generationId: generation.id,
        images: generation.images,
      };
    },
    { isolationLevel: "Serializable" }
  );

  if (!prepared) return;

  // The generation is now atomically CANCELLED, so completeGeneration can no
  // longer win a race and turn it into COMPLETED before the refund decision.
  await refundCredits({
    userId: prepared.userId,
    generationId: prepared.generationId,
    description: "Refund for deleted incomplete generation",
  });

  await prisma.$transaction(async (tx) => {
    await tx.image.deleteMany({
      where: { generationId: prepared.generationId },
    });

    await tx.generation.deleteMany({
      where: {
        id: prepared.generationId,
        status: { in: REFUNDABLE_STATUSES },
      },
    });
  });

  // Blob deletion is best-effort after the database state is finalized.
  // Missing/already-deleted blobs are safe to retry later.
  for (const image of prepared.images) {
    try {
      await deleteFromStorage({ blobUrl: image.blobUrl });
    } catch (error) {
      console.error(
        `Generation ${generationId} blob cleanup failed for ${image.storageKey}:`,
        error
      );
    }
  }
}
