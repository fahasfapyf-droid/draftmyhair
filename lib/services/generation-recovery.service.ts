import { GenerationStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { refundCredits } from "@/lib/services/credit.service";
import { failGeneration } from "@/lib/services/generation-lifecycle.service";

const STALE_QUEUED_MINUTES = 15;
const STALE_PROCESSING_MINUTES = 30;

export type RecoverySummary = {
  queuedRecovered: number;
  processingRecovered: number;
};

function minutesAgo(minutes: number) {
  return new Date(Date.now() - minutes * 60 * 1000);
}

async function refundRecoveredGeneration(
  generationId: string,
  userId: string,
  description: string
) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await refundCredits({ userId, generationId, description });
      return;
    } catch (error) {
      if (attempt === 3) throw error;
      console.error(`Generation ${generationId} refund attempt ${attempt} failed:`, error);
    }
  }
}

export async function recoverStaleGeneration(generationId: string): Promise<boolean> {
  const generation = await prisma.generation.findUnique({
    where: { id: generationId },
    select: {
      id: true,
      userId: true,
      status: true,
      createdAt: true,
      processingStartedAt: true,
    },
  });

  if (!generation) return false;

  const now = Date.now();
  const isStaleQueued =
    generation.status === GenerationStatus.QUEUED &&
    generation.createdAt.getTime() < now - STALE_QUEUED_MINUTES * 60 * 1000;
  const isStaleProcessing =
    generation.status === GenerationStatus.PROCESSING &&
    generation.processingStartedAt !== null &&
    generation.processingStartedAt.getTime() < now - STALE_PROCESSING_MINUTES * 60 * 1000;

  if (!isStaleQueued && !isStaleProcessing) return false;

  const errorMessage = isStaleQueued
    ? "Generation abandoned before processing."
    : "Generation interrupted during processing.";

  try {
    await failGeneration(
      generation.id,
      errorMessage,
      generation.processingStartedAt ?? undefined
    );
  } catch (error) {
    console.error(`Failed to recover generation ${generation.id}:`, error);
    return false;
  }

  try {
    await refundRecoveredGeneration(
      generation.id,
      generation.userId,
      isStaleQueued ? "Refund for abandoned generation" : "Refund for interrupted generation"
    );
  } catch (error) {
    console.error(`Failed to refund recovered generation ${generation.id}:`, error);
  }

  return true;
}

export async function recoverStaleGenerations(): Promise<RecoverySummary> {
  const stale = await prisma.generation.findMany({
    where: {
      OR: [
        {
          status: GenerationStatus.QUEUED,
          createdAt: { lt: minutesAgo(STALE_QUEUED_MINUTES) },
        },
        {
          status: GenerationStatus.PROCESSING,
          processingStartedAt: {
            not: null,
            lt: minutesAgo(STALE_PROCESSING_MINUTES),
          },
        },
      ],
    },
    select: { id: true, status: true },
  });

  let queuedRecovered = 0;
  let processingRecovered = 0;

  for (const generation of stale) {
    const recovered = await recoverStaleGeneration(generation.id);
    if (!recovered) continue;

    if (generation.status === GenerationStatus.QUEUED) {
      queuedRecovered += 1;
    } else if (generation.status === GenerationStatus.PROCESSING) {
      processingRecovered += 1;
    }
  }

  return { queuedRecovered, processingRecovered };
}
