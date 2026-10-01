import { GenerationStatus } from "@prisma/client";
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { isAdmin } from "@/lib/auth/authorization";
import { InternalAccessError, requireInternalAccess } from "@/lib/internal/auth";
import { prisma } from "@/lib/prisma";

interface RouteContext {
  params: Promise<{
    generationId: string;
  }>;
}

/**
 * ============================================================
 * Draft My Hair — Internal Optimizer: Status / Result
 * ============================================================
 *
 * Authenticated status + retrieval metadata for the optimizer. Accepted
 * auth: Bearer DMH_INTERNAL_TOKEN (server-to-server) OR an admin session.
 * The artifact download happens at
 *   GET /api/internal/optimizer/generations/{generationId}/result
 * (token-only, server-side stream) — /api/blob is never used here.
 * Never exposes Vertex credentials or the internal token.
 */
export async function GET(request: Request, { params }: RouteContext) {
  let internalAuthorized = true;
  try {
    requireInternalAccess(request.headers.get("authorization"));
  } catch (error) {
    if (error instanceof InternalAccessError) {
      internalAuthorized = false;
    } else {
      throw error;
    }
  }

  if (!internalAuthorized) {
    const session = await auth();
    if (!isAdmin(session)) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
  }

  const { generationId } = await params;

  const generation = await prisma.generation.findUnique({
    where: { id: generationId },
    select: {
      status: true,
      completedAt: true,
      errorMessage: true,
      resultStorageKey: true,
      provider: true,
      providerModel: true,
      promptKey: true,
      promptVersion: true,
      createdAt: true,
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
      resultUrl:
        generation.status === GenerationStatus.COMPLETED &&
        generation.resultStorageKey
          ? `/api/internal/optimizer/generations/${encodeURIComponent(
              generationId
            )}/result`
          : null,
      model: generation.providerModel,
      provider: generation.provider,
      promptKey: generation.promptKey,
      promptVersion: generation.promptVersion,
      createdAt: generation.createdAt,
    },
    {
      headers: {
        "Cache-Control": "private, no-store",
      },
    }
  );
}
