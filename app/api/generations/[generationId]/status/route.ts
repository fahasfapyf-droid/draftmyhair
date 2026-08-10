import { GenerationStatus } from "@prisma/client";
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { recoverStaleGeneration } from "@/lib/services/generation-recovery.service";

interface RouteContext {
  params: Promise<{
    generationId: string;
  }>;
}

export async function GET(
  _request: Request,
  { params }: RouteContext
) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Unauthorized." },
      { status: 401 }
    );
  }

  const { generationId } = await params;

  // Authorize the generation before performing any lifecycle mutation.
  // Recovery is deliberately scoped to a generation the caller can access.
  const generation = await prisma.generation.findFirst({
    where: {
      id: generationId,
      ...(session.user.role === "ADMIN"
        ? {}
        : { userId: session.user.id }),
    },
    select: {
      status: true,
      completedAt: true,
      errorMessage: true,
      resultStorageKey: true,
    },
  });

  if (!generation) {
    return NextResponse.json(
      { error: "Generation not found." },
      { status: 404 }
    );
  }

  try {
    await recoverStaleGeneration(generationId);
  } catch (error) {
    console.error(`Stale generation recovery failed for ${generationId}:`, error);
  }

  const latestGeneration = await prisma.generation.findFirst({
    where: {
      id: generationId,
      ...(session.user.role === "ADMIN"
        ? {}
        : { userId: session.user.id }),
    },
    select: {
      status: true,
      completedAt: true,
      errorMessage: true,
      resultStorageKey: true,
    },
  });

  if (!latestGeneration) {
    return NextResponse.json(
      { error: "Generation not found." },
      { status: 404 }
    );
  }

  return NextResponse.json(
    {
      status: latestGeneration.status,
      completedAt: latestGeneration.completedAt,
      error: latestGeneration.errorMessage,
      imageUrl:
        latestGeneration.status === GenerationStatus.COMPLETED &&
        latestGeneration.resultStorageKey
          ? `/api/blob?pathname=${encodeURIComponent(latestGeneration.resultStorageKey)}`
          : null,
    },
    {
      headers: {
        "Cache-Control": "private, no-store",
      },
    }
  );
}
