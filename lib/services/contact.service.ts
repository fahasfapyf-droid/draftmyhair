import { prisma } from "@/lib/prisma";

export async function getContactMessages() {
  return prisma.contactMessage.findMany({
    orderBy: {
      createdAt: "desc",
    },
  });
}