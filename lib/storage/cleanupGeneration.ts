import { GenerationStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { refundCredits } from "@/lib/services/credit.service";
import { deleteFromStorage } from "@/lib/storage";

export async function cleanupGeneration(
  generationId: string
): Promise<void> {
  const generation = await prisma.generation.findUnique({
    where: { id: generationId },
    include: { images: true },
  });

  if (!generation) return;

  if (
    generation.status === GenerationStatus.QUEUED ||
    generation.status === GenerationStatus.PROCESSING ||
    generation.status === GenerationStatus.FAILED
  ) {
    await refundCredits({
      userId: generation.userId,
      generationId: generation.id,
      description: "Refund for deleted incomplete generation",
    });
  }

  // Remove database records first so a storage failure can never leave a
  // visible generation pointing at a partially deleted set of blobs.
  await prisma.$transaction(async (tx) => {
    await tx.image.deleteMany({ where: { generationId } });
    await tx.generation.delete({ where: { id: generationId } });
  });

  // Blob deletion is best-effort after the database state is finalized.
  // A failed blob cleanup creates storage debt, not a broken user-visible
  // generation. Missing/already-deleted blobs are safe to retry later.
  for (const image of generation.images) {
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
