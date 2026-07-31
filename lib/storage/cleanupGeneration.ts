import { prisma } from "@/lib/prisma";
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

  // Delete every blob first.
  // If any deletion fails, stop immediately.
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