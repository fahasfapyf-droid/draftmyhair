import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRndWorker } from "@/lib/rnd/worker-auth";
import { runRndQa } from "@/lib/rnd/qa";

export const runtime = "nodejs";

async function fetchPrivateArtifact(blobUrl: string, mimeType: string) {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new Error("Blob storage is not configured.");
  const response = await fetch(blobUrl, {
    headers: { Authorization: "Bearer " + token },
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error("Artifact could not be retrieved.");
  return { buffer: Buffer.from(await response.arrayBuffer()), mimeType };
}

export async function POST(request: Request) {
  const authResponse = requireRndWorker(request.headers.get("authorization"));
  if (authResponse) return authResponse;

  const body = (await request.json().catch(() => null)) as { attemptId?: unknown } | null;
  const attemptId = typeof body?.attemptId === "string" ? body.attemptId : null;
  if (!attemptId) return NextResponse.json({ error: "attemptId is required" }, { status: 400 });

  const attempt = await prisma.rnDAttempt.findUnique({
    where: { id: attemptId },
    select: {
      id: true,
      attemptNumber: true,
      prompt: true,
      artifact: { select: { blobUrl: true, mimeType: true } },
      job: {
        select: {
          id: true,
          target: {
            select: {
              sourceAsset: { select: { blobUrl: true, mimeType: true } },
            },
          },
        },
      },
    },
  });

  if (!attempt) return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
  if (!attempt.artifact) return NextResponse.json({ error: "Attempt has no artifact" }, { status: 422 });

  try {
    const [source, generated] = await Promise.all([
      fetchPrivateArtifact(attempt.job.target.sourceAsset.blobUrl, attempt.job.target.sourceAsset.mimeType),
      fetchPrivateArtifact(attempt.artifact.blobUrl, attempt.artifact.mimeType),
    ]);

    const qa = await runRndQa(
      source.buffer,
      source.mimeType,
      generated.buffer,
      generated.mimeType,
      attempt.prompt,
    );

    return NextResponse.json({
      ok: true,
      jobId: attempt.job.id,
      attemptId: attempt.id,
      attemptNumber: attempt.attemptNumber,
      qa: {
        overall: qa.overall,
        transformationFloor: qa.transformationFloor,
        productionReady: qa.productionReady,
        hairstyleAccuracy: qa.hairstyleAccuracy,
        styleLengthAccuracy: qa.styleLengthAccuracy,
        styleSilhouetteAccuracy: qa.styleSilhouetteAccuracy,
        styleWeightDistribution: qa.styleWeightDistribution,
        stylePerimeterAccuracy: qa.stylePerimeterAccuracy,
        styleStylingAccuracy: qa.styleStylingAccuracy,
        styleRealism: qa.styleRealism,
        rootIntegration: qa.rootIntegration,
        identity: qa.identity,
        lightingConsistency: qa.lightingConsistency,
        hairOnly: qa.hairOnly,
        transformationOnly: qa.transformationOnly,
        artifacts: qa.artifacts,
        verdict: qa.verdict,
        reason: qa.reason,
        refinement: qa.refinement,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "QA rerun failed." },
      { status: 503 },
    );
  }
}
