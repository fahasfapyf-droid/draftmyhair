import { GenerationStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { refundCredits } from "@/lib/services/credit.service";
import { deleteFromStorage } from "@/lib/storage";

export async function cleanupGeneration(
  generationId: string
): Promise<void> {
  const generation = await prisma.generation.findUnique({
    where: {
      id: generationId,
    },
    include: {
      images: true,
    },
  });

  if (!generation) {
    return;
  }

  // Deleting an incomplete generation must not permanently consume the
  // user's credit. refundCredits is idempotent by generationId, so this is
  // safe for FAILED generations that were already refunded elsewhere.
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

  // Delete every blob first.
  // If any deletion fails, stop immediately so the database remains intact.
  for (const image of generation.images) {
    await deleteFromStorage({
      blobUrl: image.blobUrl,
    });
  }

  // Remove database records atomically.
  await prisma.$transaction(async (tx) => {
    await tx.image.deleteMany({
      where: {
        generationId,
      },
    });

    await tx.generation.delete({
      where: {
        id: generationId,
      },
    });
  });
}
