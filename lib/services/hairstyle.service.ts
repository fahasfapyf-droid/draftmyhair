import { prisma } from "@/lib/prisma";
import { GenderTarget, HairstyleCategory, ServiceType } from "@prisma/client";

type ActiveHairstyleFilters = {
  gender?: GenderTarget;
  serviceType?: ServiceType;
  category?: HairstyleCategory;
};

export async function getActiveHairstyles({
  gender,
  serviceType,
  category,
}: ActiveHairstyleFilters = {}) {
  return prisma.hairstyle.findMany({
    where: {
      isActive: true,
      ...(serviceType ? { serviceType } : {}),
      ...(category ? { category } : {}),
      ...(gender
        ? {
            OR:
              gender === GenderTarget.UNISEX
                ? [{ gender: GenderTarget.UNISEX }]
                : [{ gender }, { gender: GenderTarget.UNISEX }],
          }
        : {}),
    },
    orderBy: {
      displayOrder: "asc",
    },
    select: {
      id: true,
      slug: true,
      name: true,
      serviceType: true,
      category: true,
      description: true,
      thumbnailUrl: true,
      promptKey: true,
      gender: true,
      displayOrder: true,
    },
  });
}
