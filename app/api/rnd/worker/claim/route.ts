import { configuredGenerationBudget, generationBudget } from "@/lib/rnd/retry-policy";
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { readPriorRndArtifactChecksums } from "@/lib/rnd/artifact-checksums";
import { MAX_RND_INFRASTRUCTURE_RETRIES, requireRndWorker, RND_WORKER_LEASE_SECONDS, RND_WORKER_PROTOCOL_VERSION } from "@/lib/rnd/worker-auth";

export const runtime = "nodejs";
export async function POST(request: Request) {
  const authResponse = requireRndWorker(request.headers.get("authorization"));
  if (authResponse) return authResponse;
  if (request.headers.get("x-rnd-worker-protocol") !== RND_WORKER_PROTOCOL_VERSION) {
    return NextResponse.json({ code: "RND_WORKER_PROTOCOL_REQUIRED" }, { status: 409 });
  }

  let globalBudget: number;
  try { globalBudget = configuredGenerationBudget(); } catch { return NextResponse.json({ code: "RND_INVALID_ATTEMPT_BUDGET" }, { status: 503 }); }
  const workerId = request.headers.get("x-rnd-worker-id")?.trim() || randomUUID();
  const now = new Date();
  const leaseExpiresAt = new Date(now.getTime() + RND_WORKER_LEASE_SECONDS * 1000);

  const claimed = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`WITH lock AS (SELECT pg_advisory_xact_lock(hashtext('draftmyhair-rnd-generation'))) SELECT 1 AS locked FROM lock`;

    // Stop stale runaway jobs before claiming any more work. The ceiling applies
    // to actual generated attempts, not profile-quota rotations.
    const overLimitJobs = await tx.rnDJob.findMany({
      where: { status: { in: ["QUEUED", "PROCESSING"] }, attemptCount: { gte: globalBudget } },
      select: { id: true, targetId: true },
    });
    for (const overLimit of overLimitJobs) {
      const stopped = await tx.rnDJob.updateMany({
        where: { id: overLimit.id, status: { in: ["QUEUED", "PROCESSING"] }, attemptCount: { gte: globalBudget } },
        data: {
          status: "FAILED",
          leaseOwner: null,
          leaseExpiresAt: null,
          completedAt: now,
          failureCode: "RND_CONVERGENCE_LIMIT",
          failureMessage: `R&D stopped after ${globalBudget} attempts without satisfying every hard-pass gate.`,
        },
      });
      if (stopped.count === 1) await tx.rnDTarget.update({ where: { id: overLimit.targetId }, data: { status: "FAILED" } });
    }

    // Visual convergence and infrastructure recovery have separate durable caps.

    // Queue priority fix: queued regression work must win before lease recovery.
    // Always prefer genuinely QUEUED work over an expired PROCESSING lease.
    // An expired job may have a recently refreshed queuedAt after a retry and
    // must not preempt a fresh regression job waiting in the queue.
    const queuedCandidate = await tx.rnDJob.findFirst({
      where: {
        status: "QUEUED",
        attemptCount: { lt: globalBudget },
        OR: [{ nextEligibleAt: null }, { nextEligibleAt: { lte: now } }],
      },
      orderBy: { queuedAt: "desc" },
      select: { id: true, targetId: true, attemptCount: true, currentPrompt: true, status: true, startedAt: true, maxGenerationAttempts: true, infrastructureRetryCount: true },
    });

    const candidate =
      queuedCandidate ??
      (await tx.rnDJob.findFirst({
        where: {
          status: "PROCESSING",
          attemptCount: { lt: globalBudget },
          OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lt: now } }],
        },
        orderBy: { queuedAt: "desc" },
        select: { id: true, targetId: true, attemptCount: true, currentPrompt: true, status: true, startedAt: true, maxGenerationAttempts: true, infrastructureRetryCount: true },
      }));

    if (!candidate) return null;
    if (candidate.attemptCount >= generationBudget(candidate.maxGenerationAttempts) || candidate.infrastructureRetryCount > MAX_RND_INFRASTRUCTURE_RETRIES) {
      const code = candidate.infrastructureRetryCount > MAX_RND_INFRASTRUCTURE_RETRIES ? "RND_INFRASTRUCTURE_RETRY_LIMIT" : "RND_CONVERGENCE_LIMIT";
      const stopped = await tx.rnDJob.updateMany({ where: { id: candidate.id, status: candidate.status, startedAt: candidate.startedAt, attemptCount: candidate.attemptCount },
        data: { status: "FAILED", leaseOwner: null, leaseExpiresAt: null, completedAt: now, failureCode: code, failureMessage: "R&D durable budget exhausted; no further generation authorized." } });
      if (stopped.count === 1) await tx.rnDTarget.update({ where: { id: candidate.targetId }, data: { status: "FAILED" } });
      return null;
    }

    const claimStartedAt = new Date(Math.max(now.getTime(), (candidate.startedAt?.getTime() ?? 0) + 1));
    const updated = await tx.rnDJob.updateMany({
      where: {
        id: candidate.id,
        startedAt: candidate.startedAt,
        attemptCount: candidate.attemptCount,
        OR: [
          { status: "QUEUED", AND: [{ OR: [{ nextEligibleAt: null }, { nextEligibleAt: { lte: now } }] }] },
          { status: "PROCESSING", OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lt: now } }] },
        ],
      },
      data: { status: "PROCESSING", leaseOwner: workerId, leaseExpiresAt, heartbeatAt: now, startedAt: claimStartedAt },
    });
    if (updated.count !== 1) return null;

    const attemptNumber = candidate.attemptCount + 1;
    const reservation = await tx.rnDAttempt.findUnique({
      where: { jobId_attemptNumber: { jobId: candidate.id, attemptNumber } },
      select: { id: true, artifactId: true, generationStartedAt: true, generationCompletedAt: true, promptRevision: true, errorCode: true },
    });
    if (candidate.status === "PROCESSING") {
      const recovered = reservation && await tx.rnDAttempt.update({
        where: { id: reservation.id },
        data: { infrastructureRetryCount: { increment: 1 } },
        select: { infrastructureRetryCount: true },
      });
      const jobRetry = await tx.rnDJob.update({ where: { id: candidate.id }, data: { infrastructureRetryCount: { increment: 1 } }, select: { infrastructureRetryCount: true } });
      if (!recovered || recovered.infrastructureRetryCount > MAX_RND_INFRASTRUCTURE_RETRIES || jobRetry.infrastructureRetryCount > MAX_RND_INFRASTRUCTURE_RETRIES) {
        const failureCode = recovered ? "RND_INFRASTRUCTURE_RETRY_LIMIT" : "RND_LEASE_RESERVATION_MISSING";
        const failureMessage = "Expired R&D lease cannot be recovered within the infrastructure retry budget.";
        if (reservation) await tx.rnDAttempt.update({
          where: { id: reservation.id },
          data: { verdict: "FAILED", errorCode: failureCode, errorMessage: failureMessage },
        });
        await tx.rnDJob.update({
          where: { id: candidate.id },
          data: { status: "FAILED", leaseOwner: null, leaseExpiresAt: null, completedAt: now, failureCode, failureMessage },
        });
        await tx.rnDTarget.update({ where: { id: candidate.targetId }, data: { status: "FAILED" } });
        return null;
      }
    }
    const completedArtifact = reservation?.errorCode === "RND_SUBMITTED" && reservation.generationCompletedAt
      ? reservation.artifactId : null;
    // Older reservations were created before submission fencing and are ambiguous.
    if (reservation && !completedArtifact && (reservation.promptRevision !== "reserved-v2" ||
        reservation.generationStartedAt || reservation.artifactId || reservation.errorCode)) {
      const failureCode = "RND_SUBMISSION_REQUIRES_RECONCILIATION";
      await tx.rnDAttempt.update({ where: { id: reservation.id }, data: { verdict: "FAILED", errorCode: failureCode } });
      await tx.rnDJob.update({ where: { id: candidate.id }, data: { status: "FAILED", completedAt: now,
        leaseOwner: null, leaseExpiresAt: null, nextEligibleAt: null, failureCode, failureMessage: "Submission outcome is uncertain; administrative reconciliation required, never automatic regeneration." } });
      await tx.rnDTarget.update({ where: { id: candidate.targetId }, data: { status: "FAILED" } });
      return null;
    }
    if (!reservation) {
      await tx.rnDAttempt.create({
        data: {
          jobId: candidate.id,
          attemptNumber,
          prompt: candidate.currentPrompt,
          promptRevision: "reserved-v2",
          submittedAt: null,
          verdict: "REFINE",
        },
        select: { id: true },
      });
    }

    await tx.rnDTarget.update({ where: { id: candidate.targetId }, data: { status: "PROCESSING", currentJobId: candidate.id } });
    const job = await tx.rnDJob.findUnique({
      where: { id: candidate.id },
      include: { target: { include: { sourceAsset: true } } },
    });
    if (!job) return null;
    const priorArtifactChecksums = completedArtifact ? [] : await readPriorRndArtifactChecksums(tx, job.id, attemptNumber);
    return { ...job, resumeArtifactId: completedArtifact, priorArtifactChecksums };
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
      claimGeneration: claimed.startedAt?.toISOString() ?? null,
      resumeArtifactId: claimed.resumeArtifactId,
      priorArtifactChecksums: claimed.priorArtifactChecksums,
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
