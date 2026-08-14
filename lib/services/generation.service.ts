import { prisma } from "@/lib/prisma";

export async function getUserGenerations(userId: string, salonClientId?: string) {
  const generations = await prisma.generation.findMany({
    where: {
      userId,
      ...(salonClientId ? { salonClientId } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      hairstyle: { select: { id: true, name: true } },
      salonClient: { select: { id: true, name: true } },
      feedback: {
        select: {
          id: true,
          overallRating: true,
          identityRating: true,
          realismRating: true,
          decisionConfidence: true,
          issues: true,
          comment: true,
          createdAt: true,
        },
      },
    },
  });

  return generations.map((generation) => ({
    ...generation,
    outputImageUrl: generation.resultStorageKey
      ? `/api/blob?pathname=${encodeURIComponent(generation.resultStorageKey)}`
      : null,
    userFeedback: generation.feedback,
  }));
}
