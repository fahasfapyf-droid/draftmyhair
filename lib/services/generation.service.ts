import { prisma } from "@/lib/prisma";

export async function getUserGenerations(userId: string, salonClientId?: string) {
  const generations = await prisma.generation.findMany({
    where: { userId, ...(salonClientId ? { salonClientId } : {}) },
    orderBy: { createdAt: "desc" },
    include: {
      hairstyle: { select: { id: true, name: true } },
      salonClient: { select: { id: true, name: true } },
    },
  });

  const feedbackIds = generations
    .map((generation) => {
      const metadata = generation.metadata;
      if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
      const feedbackId = (metadata as Record<string, unknown>).feedbackId;
      return typeof feedbackId === "string" ? feedbackId : null;
    })
    .filter((id): id is string => Boolean(id));

  const feedbackRows = feedbackIds.length
    ? await prisma.feedback.findMany({
        where: { id: { in: feedbackIds }, userId },
        select: { id: true, overallRating: true, identityRating: true, realismRating: true },
      })
    : [];

  const feedbackById = new Map(feedbackRows.map((feedback) => [feedback.id, feedback]));

  return generations.map((generation) => {
    const metadata = generation.metadata;
    const feedbackId = metadata && typeof metadata === "object" && !Array.isArray(metadata)
      ? (metadata as Record<string, unknown>).feedbackId
      : null;

    return {
      ...generation,
      outputImageUrl: generation.resultStorageKey
        ? `/api/blob?pathname=${encodeURIComponent(generation.resultStorageKey)}`
        : null,
      userFeedback: typeof feedbackId === "string" ? feedbackById.get(feedbackId) ?? null : null,
    };
  });
}
