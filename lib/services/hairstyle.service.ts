import { prisma } from "@/lib/prisma";

export async function getActiveHairstyles() {
  return prisma.hairstyle.findMany({
    where: {
      isActive: true,
    },
    orderBy: {
      displayOrder: "asc",
    },
    select: {
      id: true,
      slug: true,
      name: true,
      category: true,
      description: true,
      thumbnailUrl: true,
      promptKey: true,
      gender: true,
      displayOrder: true,
    },
  });
}