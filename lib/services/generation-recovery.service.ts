import { GenerationStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { failGeneration } from "@/lib/services/generation-lifecycle.service";

const STALE_QUEUED_MINUTES = 15;
const STALE_PROCESSING_MINUTES = 30;

type RecoverySummary = {
  queuedRecovered: number;
  processingRecovered: number;
};

function minutesAgo(minutes: number) {
  return new Date(Date.now() - minutes * 60 * 1000);
}

export async function recoverStaleGenerations(): Promise<RecoverySummary> {
  const queuedThreshold = minutesAgo(STALE_QUEUED_MINUTES);
  const processingThreshold = minutesAgo(STALE_PROCESSING_MINUTES);

  const staleQueued = await prisma.generation.findMany({
    where: {
      status: GenerationStatus.QUEUED,
      createdAt: {
        lt: queuedThreshold,
      },
    },
    select: {
      id: true,
    },
  });

  const staleProcessing = await prisma.generation.findMany({
    where: {
      status: GenerationStatus.PROCESSING,
      processingStartedAt: {
        not: null,
        lt: processingThreshold,
      },
    },
    select: {
      id: true,
      processingStartedAt: true,
    },
  });

  let queuedRecovered = 0;
  let processingRecovered = 0;

  for (const generation of staleQueued) {
    try {
      await failGeneration(
        generation.id,
        "Generation abandoned before processing."
      );

      queuedRecovered++;
    } catch (error) {
      console.error(
        `Failed to recover queued generation ${generation.id}:`,
        error
      );
    }
  }

  for (const generation of staleProcessing) {
    try {
      await failGeneration(
        generation.id,
        "Generation interrupted during processing.",
        generation.processingStartedAt ?? undefined
      );

      processingRecovered++;
    } catch (error) {
      console.error(
        `Failed to recover processing generation ${generation.id}:`,
        error
      );
    }
  }

  return {
    queuedRecovered,
    processingRecovered,
  };
}