import { GenerationStatus } from "@prisma/client";
import { get } from "@vercel/blob";
import { NextResponse } from "next/server";

import { InternalAccessError, requireInternalAccess } from "@/lib/internal/auth";
import { resolveOptimizerResultAccess } from "@/lib/internal/optimizer-result";
import { prisma } from "@/lib/prisma";

interface RouteContext {
  params: Promise<{
    generationId: string;
  }>;
}

/**
 * ============================================================
 * Draft My Hair — Internal Optimizer: Result download
 * ============================================================
 *
 * Server-side result artifact stream for the Prompt Lab optimizer.
 *
 * Why not /api/blob? /api/blob requires the normal NextAuth user
 * session. The optimizer authenticates with DMH_INTERNAL_TOKEN, so this
 * endpoint authenticates with that token and STREAMS the private Blob
 * server-side. No redirect, no public/signed URL, and /api/blob is
 * unchanged.
 *
 * Only the internal/system generation flow is downloadable here;
 * a customer generation returns 404 (indistinguishable from unknown).
 */
export async function GET(request: Request, { params }: RouteContext) {
  try {
    requireInternalAccess(request.headers.get("authorization"));
  } catch (error) {
    if (error instanceof InternalAccessError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    throw error;
  }

  const { generationId } = await params;

  const generation = await prisma.generation.findUnique({
    where: { id: generationId },
    select: {
      userId: true,
      status: true,
      resultStorageKey: true,
    },
  });

  const decision = resolveOptimizerResultAccess(
    generation,
    process.env.INTERNAL_SYSTEM_USER_ID
  );

  if (!decision.ok) {
    console.log(
      "[INTERNAL_RESULT_REJECTED]",
      JSON.stringify({
        generationId,
        status: decision.status,
        reason: decision.error,
      })
    );
    return NextResponse.json(
      { error: decision.error },
      { status: decision.status }
    );
  }

  // decision.ok guarantees generation non-null, COMPLETED, with a
  // storage key — these guards exist for the type system.
  if (
    !generation ||
    generation.status !== GenerationStatus.COMPLETED ||
    !generation.resultStorageKey
  ) {
    return NextResponse.json(
      { error: "Generation not completed." },
      { status: 409 }
    );
  }

  let blob;
  try {
    blob = await get(generation.resultStorageKey, { access: "private" });
  } catch {
    return NextResponse.json(
      { error: "Result unavailable." },
      { status: 404 }
    );
  }
  if (!blob) {
    return NextResponse.json(
      { error: "Result unavailable." },
      { status: 404 }
    );
  }

  console.log(
    "[INTERNAL_RESULT]",
    JSON.stringify({
      generationId,
      outcome: "streamed",
      bytes: blob.blob.size,
    })
  );

  return new NextResponse(blob.stream, {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Type": blob.blob.contentType ?? "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
