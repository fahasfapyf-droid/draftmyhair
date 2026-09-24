import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { requireRndWorker, RND_WORKER_LEASE_SECONDS } from "@/lib/rnd/worker-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const authResponse = requireRndWorker(request.headers.get("authorization"));
  if (authResponse) return authResponse;

  const workerId = request.headers.get("x-rnd-worker-id")?.trim() || randomUUID();
  const now = new Date();
  const leaseExpiresAt = new Date(now.getTime() + RND_WORKER_LEASE_SECONDS * 1000);

  const claimed = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`WITH lock AS (SELECT pg_advisory_xact_lock(hashtext('draftmyhair-rnd-generation'))) SELECT 1 AS locked FROM lock`;

    // This is the isolated local R&D worker path. Generation throughput is
    // controlled by the queue, per-job two-attempt ceiling, and worker lease;
    // do not block controlled regression runs with the old global rate guard.

    const candidate = await tx.rnDJob.findFirst({
      where: {
        OR: [
          { status: "QUEUED", AND: [{ OR: [{ nextEligibleAt: null }, { nextEligibleAt: { lte: now } }] }] },
          { status: "PROCESSING", OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lt: now } }] },
        ],
      },
      orderBy: { queuedAt: "desc" },
      select: { id: true, targetId: true, attemptCount: true, currentPrompt: true },
    });
    if (!candidate) return null;

    const updated = await tx.rnDJob.updateMany({
      where: {
        id: candidate.id,
        OR: [
          { status: "QUEUED", AND: [{ OR: [{ nextEligibleAt: null }, { nextEligibleAt: { lte: now } }] }] },
          { status: "PROCESSING", OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lt: now } }] },
        ],
      },
      data: { status: "PROCESSING", leaseOwner: workerId, leaseExpiresAt, heartbeatAt: now, startedAt: now },
    });
    if (updated.count !== 1) return null;

    const attemptNumber = candidate.attemptCount + 1;
    let reservation = await tx.rnDAttempt.findUnique({
      where: { jobId_attemptNumber: { jobId: candidate.id, attemptNumber } },
      select: { id: true },
    });
    if (!reservation) {
      reservation = await tx.rnDAttempt.create({
        data: {
          jobId: candidate.id,
          attemptNumber,
          prompt: candidate.currentPrompt,
          promptRevision: "reserved",
          submittedAt: now,
          verdict: "REFINE",
        },
        select: { id: true },
      });
    }

    await tx.rnDTarget.update({ where: { id: candidate.targetId }, data: { status: "PROCESSING", currentJobId: candidate.id } });
    return tx.rnDJob.findUnique({
      where: { id: candidate.id },
      include: { target: { include: { sourceAsset: true } } },
    });
  });

  if (!claimed) return NextResponse.json({ ok: true, job: null });

  const attemptNumber = claimed.attemptCount + 1;
  return NextResponse.json({
    ok: true,
    workerId,
    leaseExpiresAt: claimed.leaseExpiresAt?.toISOString() ?? null,
    attemptNumber,
    job: {
      id: claimed.id,
      targetId: claimed.targetId,
      status: claimed.status,
      promptVersionNumber: claimed.promptVersionNumber,
      currentPrompt: claimed.currentPrompt,
      attemptCount: claimed.attemptCount,
      attemptNumber,
      target: {
        id: claimed.target.id,
        targetType: claimed.target.targetType,
        targetKey: claimed.target.targetKey,
        hairstyleId: claimed.target.hairstyleId,
        hairColorKey: claimed.target.hairColorKey,
        beardKey: claimed.target.beardKey,
        hardCoreInstruction: claimed.target.hardCoreInstruction,
        sourceAssetId: claimed.target.sourceAssetId,
      },
      sourceAsset: {
        id: claimed.target.sourceAsset.id,
        kind: claimed.target.sourceAsset.kind,
        storageKey: claimed.target.sourceAsset.storageKey,
        blobUrl: claimed.target.sourceAsset.blobUrl,
        mimeType: claimed.target.sourceAsset.mimeType,
        fileSize: claimed.target.sourceAsset.fileSize,
        width: claimed.target.sourceAsset.width,
        height: claimed.target.sourceAsset.height,
        checksum: claimed.target.sourceAsset.checksum,
      },
    },
  });
}
