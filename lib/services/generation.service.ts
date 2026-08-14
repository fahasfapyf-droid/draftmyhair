import { prisma } from "@/lib/prisma";

type GenerationListOptions = {
  limit?: number;
  skip?: number;
};

export async function getUserGenerations(
  userId: string,
  salonClientId?: string,
  options?: GenerationListOptions
) {
  const generations = await prisma.generation.findMany({
    where: {
      userId,
      ...(salonClientId ? { salonClientId } : {}),
    },
    orderBy: { createdAt: "desc" },
    ...(typeof options?.skip === "number" ? { skip: options.skip } : {}),
    ...(typeof options?.limit === "number" ? { take: options.limit } : {}),
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

export async function getUserGenerationsPage(
  userId: string,
  page = 1,
  pageSize = 12
) {
  const safePage = Math.max(1, page);
  const safePageSize = Math.min(Math.max(1, pageSize), 50);
  const skip = (safePage - 1) * safePageSize;

  const [generations, total] = await Promise.all([
    getUserGenerations(userId, undefined, {
      skip,
      limit: safePageSize,
    }),
    prisma.generation.count({ where: { userId } }),
  ]);

  return {
    generations,
    page: safePage,
    pageSize: safePageSize,
    total,
    hasPreviousPage: safePage > 1,
    hasNextPage: skip + generations.length < total,
  };
}
