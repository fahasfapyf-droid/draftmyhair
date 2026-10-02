import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { STYLE_PROMPTS } from "@/lib/engine/prompts/styles";
import { generateAutonomousPrompt } from "@/lib/rnd/autonomous-prompt";
import { resolvePersistedRefinementPrompt } from "@/lib/rnd/claim-prompt";
import { requireRndWorker, RND_WORKER_LEASE_SECONDS } from "@/lib/rnd/worker-auth";

export const runtime = "nodejs";
const RND_HOURLY_GENERATION_LIMIT = 60;
const RND_MIN_GENERATION_INTERVAL_MS = 60 * 1000;
const MAX_AUTONOMOUS_ATTEMPTS = Math.max(2, Number(process.env.RND_MAX_AUTONOMOUS_ATTEMPTS ?? 8));

export async function POST(request: Request) {
  const authResponse = requireRndWorker(request.headers.get("authorization"));
  if (authResponse) return authResponse;

  const workerId = request.headers.get("x-rnd-worker-id")?.trim() || randomUUID();
  const body = (await request.json().catch(() => null)) as { jobId?: unknown } | null;
  const requestedJobId = typeof body?.jobId === "string" ? body.jobId.trim() : null;
  const now = new Date();
  const leaseExpiresAt = new Date(now.getTime() + RND_WORKER_LEASE_SECONDS * 1000);

  const claimed = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`WITH lock AS (SELECT pg_advisory_xact_lock(hashtext('draftmyhair-rnd-generation'))) SELECT 1 AS locked FROM lock`;

    const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const recent = await tx.rnDAttempt.findMany({
      where: { submittedAt: { gte: hourAgo } },
      orderBy: { submittedAt: "desc" },
      take: RND_HOURLY_GENERATION_LIMIT,
      select: { submittedAt: true },
    });
    if (recent.length >= RND_HOURLY_GENERATION_LIMIT) return null;
    const lastReservation = recent[0]?.submittedAt;
    if (lastReservation && now.getTime() - lastReservation.getTime() < RND_MIN_GENERATION_INTERVAL_MS) return null;

    const baseWhere = {
      ...(requestedJobId ? { id: requestedJobId } : {}),
    };

    let candidate = await tx.rnDJob.findFirst({
      where: {
        ...baseWhere,
        status: "QUEUED",
        attemptCount: { lt: MAX_AUTONOMOUS_ATTEMPTS },
        OR: [{ nextEligibleAt: null }, { nextEligibleAt: { lte: now } }],
      },
      orderBy: [{ attemptCount: "asc" }, { queuedAt: "desc" }],
      select: { id: true, targetId: true, attemptCount: true, currentPrompt: true },
    });

    if (!candidate) {
      candidate = await tx.rnDJob.findFirst({
        where: {
          ...baseWhere,
          status: "PROCESSING",
          OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lt: now } }],
        },
        orderBy: [{ attemptCount: "asc" }, { queuedAt: "desc" }],
        select: { id: true, targetId: true, attemptCount: true, currentPrompt: true },
      });
    }

    if (!candidate) return null;

    const target = await tx.rnDTarget.findUnique({
      where: { id: candidate.targetId },
      select: { hairstyleId: true, hardCoreInstruction: true },
    });
    if (!target?.hairstyleId) throw new Error("R&D target hairstyle is missing.");

    const latestCompletedAttempt = candidate.attemptCount > 0
      ? await tx.rnDAttempt.findUnique({
          where: { jobId_attemptNumber: { jobId: candidate.id, attemptNumber: candidate.attemptCount } },
          select: { adaptiveDecision: true },
        })
      : null;

    const hairstyle = await tx.hairstyle.findUnique({
      where: { id: target.hairstyleId },
      select: { promptKey: true },
    });
    if (!hairstyle) throw new Error("R&D target hairstyle was not found.");

    // The active Content Library PromptVersion is the authoritative R&D style source.
    // Fall back to the compiled source prompt only when no active database version exists.
    const databaseStyle = await tx.promptVersion.findFirst({
      where: {
        status: "ACTIVE",
        hairstyleId: target.hairstyleId,
      },
      orderBy: { version: "desc" },
      select: { prompt: true, version: true },
    });
    const compiledStyle = STYLE_PROMPTS[hairstyle.promptKey];
    const authoritativeStylePrompt = databaseStyle?.prompt ?? compiledStyle?.prompt;
    if (!authoritativeStylePrompt) {
      throw new Error("Authoritative production prompt is missing for " + hairstyle.promptKey);
    }
    const authoritativeStyleSource = databaseStyle
      ? `database-v${databaseStyle.version}`
      : "compiled";

    let authoritativePrompt: string;
    const persistedRefinementPrompt = latestCompletedAttempt?.adaptiveDecision
      ? resolvePersistedRefinementPrompt({
          persistedPrompt: candidate.currentPrompt,
          adaptiveDecision: latestCompletedAttempt.adaptiveDecision,
        })
      : null;

    if (persistedRefinementPrompt) {
      // The report route already persisted the validated adaptive prompt selected for the next attempt.
      // Reuse it verbatim so claim-time authoritative-source changes cannot alter the worker input.
      authoritativePrompt = persistedRefinementPrompt;
    } else {
      const rebuilt = await generateAutonomousPrompt(
        target.hardCoreInstruction ?? "Validate the requested production hairstyle.",
        authoritativeStylePrompt,
      );
      authoritativePrompt = rebuilt.prompt;
    }

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

    await tx.rnDJob.update({
      where: { id: candidate.id },
      data: { currentPrompt: authoritativePrompt },
    });

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
          prompt: authoritativePrompt,
          promptRevision: authoritativeStyleSource,
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
