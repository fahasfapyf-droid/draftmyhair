import { GenerationStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getBalance } from "./credit.service";

export interface DashboardAnalytics {
  totalGenerations: number;
  completedGenerations: number;
  processingGenerations: number;
  failedGenerations: number;
  availableCredits: number;
}

export async function getDashboardAnalytics(
  userId: string
): Promise<DashboardAnalytics> {
  const [
    totalGenerations,
    completedGenerations,
    processingGenerations,
    failedGenerations,
    availableCredits,
  ] = await Promise.all([
    prisma.generation.count({
      where: {
        userId,
      },
    }),

    prisma.generation.count({
      where: {
        userId,
        status: GenerationStatus.COMPLETED,
      },
    }),

    prisma.generation.count({
      where: {
        userId,
        status: GenerationStatus.PROCESSING,
      },
    }),

    prisma.generation.count({
      where: {
        userId,
        status: GenerationStatus.FAILED,
      },
    }),

    getBalance(userId),
  ]);

  return {
    totalGenerations,
    completedGenerations,
    processingGenerations,
    failedGenerations,
    availableCredits,
  };
}