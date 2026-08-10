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

  // Client-side status polling is the reliable execution-time trigger for
  // stale recovery. It is scoped to the requested generation, so normal
  // polling does not scan the entire generations table.
  try {
    await recoverStaleGeneration(generationId);
  } catch (error) {
    console.error(`Stale generation recovery failed for ${generationId}:`, error);
  }

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

  return NextResponse.json(
    {
      status: generation.status,
      completedAt: generation.completedAt,
      error: generation.errorMessage,
      imageUrl:
        generation.status === GenerationStatus.COMPLETED &&
        generation.resultStorageKey
          ? `/api/blob?pathname=${encodeURIComponent(generation.resultStorageKey)}`
          : null,
    },
    {
      headers: {
        "Cache-Control": "private, no-store",
      },
    }
  );
}
