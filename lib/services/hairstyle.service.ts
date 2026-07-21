import { prisma } from "@/lib/prisma";

export async function getActiveHairstyles() {
  return prisma.hairstyle.findMany({
    where: {
      status: "ACTIVE",
    },
    orderBy: {
      displayOrder: "asc",
    },
    select: {
      id: true,
      slug: true,
      name: true,
      category: true,
      shortDescription: true,
      thumbnailImage: true,
      heroImage: true,
      promptKey: true,
      gender: true,
      isFeatured: true,
      displayOrder: true,
    },
  });
}