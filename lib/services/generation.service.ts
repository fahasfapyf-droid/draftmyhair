import { prisma } from "@/lib/prisma";

export async function getUserGenerations(userId: string) {
  const generations = await prisma.generation.findMany({
    where: {
      userId,
    },
    orderBy: {
      createdAt: "desc",
    },
    include: {
      hairstyle: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  return generations.map((generation) => ({
    ...generation,
    outputImageUrl: generation.resultStorageKey
      ? `/api/blob?pathname=${encodeURIComponent(
          generation.resultStorageKey
        )}`
      : null,
  }));
}