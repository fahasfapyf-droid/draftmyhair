import { prisma } from "@/lib/prisma";
import { GenderTarget, ServiceType } from "@prisma/client";

type ActiveHairstyleFilters = {
  gender?: GenderTarget;
  serviceType?: ServiceType;
};

export async function getActiveHairstyles({
  gender,
  serviceType,
}: ActiveHairstyleFilters = {}) {
  return prisma.hairstyle.findMany({
    where: {
      isActive: true,
      ...(serviceType ? { serviceType } : {}),
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
