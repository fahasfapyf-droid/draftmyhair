import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRndWorker } from "@/lib/rnd/worker-auth";
import { runRndFinalVerification, runRndQa } from "@/lib/rnd/qa";
import { buildRndPrompt } from "@/lib/rnd/prompt";
import { hindsightEnabled, recallRndHistory, retainRndOutcome } from "@/lib/rnd/hindsight";
import { runRndImageIntegrityCheck } from "@/lib/rnd/image-integrity";

export const runtime = "nodejs";
const QA_TIMEOUT_MS = 120_000;

type ReportBody = {
  jobId?: unknown;
  attemptNumber?: unknown;
  prompt?: unknown;
  promptRevision?: unknown;
  submittedAt?: unknown;
  generationStartedAt?: unknown;
  generationCompletedAt?: unknown;
  artifactId?: unknown;
  errorCode?: unknown;
  errorMessage?: unknown;
  requeueFailed?: unknown;
};

function dateOrNull(value: unknown) {
  if (typeof value !== "string") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function promptRevision(prompt: string) {
  const bytes = new TextEncoder().encode(prompt);
  let hash = 0;
  for (const byte of bytes) hash = ((hash << 5) - hash + byte) | 0;
  return Math.abs(hash).toString(16).padStart(8, "0");
}

function normalizeRefinement(value: string | null | undefined) {
  return (value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

function scoreFromQaJson(value: unknown, key: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const score = (value as Record<string, unknown>)[key];
  return typeof score === "number" ? score : typeof score === "string" ? Number(score) : null;
}

async function fetchPrivateArtifact(blobUrl: string, mimeType: string) {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new Error("Blob storage is not configured for R&D QA.");
  const response = await fetch(blobUrl, {
    headers: { Authorization: "Bearer " + token },
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error("R&D artifact could not be retrieved for QA.");
  return { buffer: Buffer.from(await response.arrayBuffer()), mimeType };
}

export async function POST(request: Request) {
  const authResponse = requireRndWorker(request.headers.get("authorization"));
  if (authResponse) return authResponse;

  const body = (await request.json().catch(() => null)) as ReportBody | null;
  if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });

  const jobId = typeof body.jobId === "string" ? body.jobId : null;
  const attemptNumber = Number.isInteger(body.attemptNumber) ? Number(body.attemptNumber) : null;
  const workerId = request.headers.get("x-rnd-worker-id")?.trim() || null;
  if (!jobId || !attemptNumber || attemptNumber < 1 || !workerId) {
    return NextResponse.json({ error: "jobId, attemptNumber and x-rnd-worker-id are required" }, { status: 400 });
  }

  const generationStartedAt = dateOrNull(body.generationStartedAt);
  const generationCompletedAt = dateOrNull(body.generationCompletedAt);
  const artifactId = typeof body.artifactId === "string" ? body.artifactId : undefined;
  const errorCode = typeof body.errorCode === "string" ? body.errorCode : null;
  const errorMessage = typeof body.errorMessage === "string" ? body.errorMessage : null;
  const now = new Date();

  const job = await prisma.rnDJob.findUnique({
    where: { id: jobId },
    select: {
      id: true,
      targetId: true,
      attemptCount: true,
      status: true,
      leaseOwner: true,
      leaseExpiresAt: true,
      currentPrompt: true,
      target: { select: { targetKey: true, hairstyleId: true, sourceAsset: { select: { blobUrl: true, mimeType: true } } } },
    },
  });
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  if (body.requeueFailed === true) {
    if (job.status !== "FAILED") {
      return NextResponse.json({ ok: true, jobId, status: job.status, requeued: false });
    }
    const retryAt = new Date(Date.now() + 60_000);
    const updated = await prisma.$transaction(async (tx) => {
      const current = await tx.rnDJob.findUnique({ where: { id: jobId }, select: { status: true, targetId: true } });
      if (!current || current.status !== "FAILED") return null;
      const next = await tx.rnDJob.update({
        where: { id: jobId },
        data: { status: "QUEUED", nextEligibleAt: retryAt, leaseOwner: null, leaseExpiresAt: null, heartbeatAt: now, completedAt: null, failureCode: null, failureMessage: null },
        select: { id: true, status: true, attemptCount: true, nextEligibleAt: true },
      });
      await tx.rnDTarget.update({ where: { id: current.targetId }, data: { status: "QUEUED" } });
      return next;
    });
    return NextResponse.json({ ok: true, jobId, status: updated?.status ?? "FAILED", requeued: Boolean(updated), nextEligibleAt: updated?.nextEligibleAt?.toISOString() ?? null });
  }
  if (job.leaseOwner !== workerId || (job.leaseExpiresAt && job.leaseExpiresAt < now) || job.status !== "PROCESSING") {
    return NextResponse.json({ error: "Job lease is no longer valid" }, { status: 409 });
  }
  if (attemptNumber !== job.attemptCount + 1) {
    return NextResponse.json({ error: "Unexpected attempt number", expectedAttemptNumber: job.attemptCount + 1 }, { status: 409 });
  }

  const reservation = await prisma.rnDAttempt.findUnique({
    where: { jobId_attemptNumber: { jobId, attemptNumber } },
    select: { id: true, submittedAt: true, artifactId: true, verdict: true },
  });
  if (!reservation) return NextResponse.json({ error: "Attempt reservation not found" }, { status: 409 });
  if (reservation.artifactId) {
    if (reservation.artifactId !== artifactId) {
      return NextResponse.json({ error: "Artifact does not belong to this R&D attempt" }, { status: 409 });
    }
    return NextResponse.json({ ok: true, jobId, attemptNumber, idempotent: true });
  }

  const prompt = job.currentPrompt;
  const revision = promptRevision(prompt);
  const succeeded = !errorCode && !errorMessage && Boolean(generationCompletedAt) && Boolean(artifactId);

  if (!succeeded) {
    const retryableWorkerFailure =
      errorCode === "WORKER_EXECUTION_ERROR" &&
      /timed out waiting for a new generated image|generation timeout|gemini.*timeout/i.test(errorMessage ?? "");

    const result = await prisma.$transaction(async (tx) => {
      const attempt = await tx.rnDAttempt.update({
        where: { jobId_attemptNumber: { jobId, attemptNumber } },
        data: { prompt, promptRevision: revision, generationStartedAt, generationCompletedAt, artifactId: null, verdict: "FAILED", errorCode, errorMessage },
      });
      if (retryableWorkerFailure) {
        await tx.rnDJob.update({
          where: { id: jobId },
          data: {
            status: "QUEUED",
            attemptCount: attemptNumber,
            nextEligibleAt: new Date(),
            leaseOwner: null,
            leaseExpiresAt: null,
            heartbeatAt: now,
            completedAt: null,
            failureCode: null,
            failureMessage: null,
          },
        });
        await tx.rnDTarget.update({ where: { id: job.targetId }, data: { status: "QUEUED" } });
      } else {
        await tx.rnDJob.update({
          where: { id: jobId },
          data: { status: "FAILED", attemptCount: attemptNumber, leaseOwner: null, leaseExpiresAt: null, heartbeatAt: now, completedAt: null, failureCode: errorCode, failureMessage: errorMessage },
        });
        await tx.rnDTarget.update({ where: { id: job.targetId }, data: { status: "FAILED" } });
      }
      return attempt;
    });
    await retainRndOutcome({
      jobId,
      attemptId: result.id,
      attemptNumber,
      targetKey: job.target.targetKey,
      hairstyleId: job.target.hairstyleId,
      prompt,
      verdict: "FAILED",
      overallScore: null,
      identityScore: null,
      styleAccuracy: null,
      rootIntegration: null,
      lightingConsistency: null,
      hairOnly: null,
      artifacts: null,
      refinement: null,
      refinementApplied: false,
      failureCode: errorCode,
      failureMessage: errorMessage,
    });
    return NextResponse.json({
      ok: true,
      jobId,
      attemptId: result.id,
      status: retryableWorkerFailure ? "QUEUED" : "FAILED",
      action: retryableWorkerFailure ? "RETRY_WORKER_TIMEOUT" : "FAILED",
    });
  }

  if (!artifactId) return NextResponse.json({ error: "artifactId is required for a successful report" }, { status: 400 });

  const artifact = await prisma.rnDAsset.findUnique({
    where: { id: artifactId },
    select: { id: true, blobUrl: true, mimeType: true },
  });
  if (!artifact) return NextResponse.json({ error: "Artifact not found" }, { status: 404 });
  if (!artifact.blobUrl || !artifact.mimeType) return NextResponse.json({ error: "Artifact is missing blob URL or MIME type" }, { status: 422 });

  let qa;
  let finalVerification = null;
  let imageIntegrity = null;
  try {
    const [source, generated] = await Promise.all([
      fetchPrivateArtifact(job.target.sourceAsset.blobUrl, job.target.sourceAsset.mimeType),
      fetchPrivateArtifact(artifact.blobUrl, artifact.mimeType),
    ]);
    imageIntegrity = await runRndImageIntegrityCheck(source.buffer, generated.buffer);
    qa = await Promise.race([
      runRndQa(source.buffer, source.mimeType, generated.buffer, generated.mimeType, prompt),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Automated QA timed out.")), QA_TIMEOUT_MS)),
    ]);

    const firstGatePass =
      qa.verdict === "APPROVE" &&
      qa.overall >= 9.5 &&
      qa.identity >= 9.5 &&
      qa.styleAccuracy >= 9.5 &&
      qa.rootIntegration >= 9.5 &&
      qa.lightingConsistency >= 9.5 &&
      qa.hairOnly === "PASS" &&
      qa.artifacts === "NONE";

    if (firstGatePass) {
      finalVerification = await Promise.race([
        runRndFinalVerification(source.buffer, source.mimeType, generated.buffer, generated.mimeType, prompt),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Final verification timed out.")), QA_TIMEOUT_MS)),
      ]);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Automated QA failed.";
    const retryableInfrastructureFailure = /(429|resource exhausted|quota|rate.?limit|too many requests)/i.test(message);
    if (retryableInfrastructureFailure) {
      const retryAt = new Date(Date.now() + 2 * 60 * 1000);
      await prisma.$transaction(async (tx) => {
        await tx.rnDJob.update({
          where: { id: jobId },
          data: {
            status: "QUEUED",
            attemptCount: attemptNumber - 1,
            nextEligibleAt: retryAt,
            leaseOwner: null,
            leaseExpiresAt: null,
            heartbeatAt: now,
            completedAt: null,
            failureCode: null,
            failureMessage: null,
          },
        });
        await tx.rnDTarget.update({ where: { id: job.targetId }, data: { status: "QUEUED" } });
      });
      return NextResponse.json({
        ok: true,
        jobId,
        attemptNumber,
        status: "QUEUED",
        action: "RETRY_QA_INFRASTRUCTURE",
        nextEligibleAt: retryAt.toISOString(),
      });
    }
    return NextResponse.json({ error: message }, { status: 503 });
  }

  const hardPass =
    qa.verdict === "APPROVE" &&
    qa.overall >= 9.5 &&
    qa.identity >= 9.5 &&
    qa.styleAccuracy >= 9.5 &&
    qa.rootIntegration >= 9.5 &&
    qa.lightingConsistency >= 9.5 &&
    qa.hairOnly === "PASS" &&
    qa.artifacts === "NONE" &&
    imageIntegrity?.canvasMatch === true &&
    imageIntegrity?.faceTexturePreservationPass === true &&
    finalVerification?.verdict === "PASS" &&
    finalVerification.overall >= 9.5 &&
    finalVerification.identity >= 9.5 &&
    finalVerification.styleAccuracy >= 9.5 &&
    finalVerification.rootIntegration >= 9.5 &&
    finalVerification.lightingConsistency >= 9.5 &&
    finalVerification.hairOnly === "PASS" &&
    finalVerification.artifacts === "NONE";

  const rawRefinement = !hardPass
    ? (finalVerification?.verdict === "REJECT" && finalVerification.refinement.trim()
        ? finalVerification.refinement.trim()
        : qa.refinement.trim() || null)
    : null;

  const previousAttempt = await prisma.rnDAttempt.findFirst({
    where: { jobId, attemptNumber: { lt: attemptNumber }, overallScore: { not: null } },
    orderBy: { attemptNumber: "desc" },
    select: {
      attemptNumber: true,
      overallScore: true,
      qaJson: true,
      refinementReason: true,
    },
  });

  const sameRefinementAsPrevious =
    Boolean(rawRefinement) &&
    Boolean(previousAttempt?.refinementReason) &&
    normalizeRefinement(rawRefinement) === normalizeRefinement(previousAttempt?.refinementReason);

  const repeatedRefinementCount = rawRefinement
    ? await prisma.rnDAttempt.count({
        where: {
          jobId,
          attemptNumber: { lt: attemptNumber },
          overallScore: { not: null },
          refinementReason: rawRefinement,
        },
      })
    : 0;

  const repeatedIneffectiveRefinement =
    sameRefinementAsPrevious &&
    (
      repeatedRefinementCount >= 2 ||
      Number(qa.styleAccuracy) <= Number(scoreFromQaJson(previousAttempt?.qaJson, "styleAccuracy") ?? -1) ||
      Number(qa.overall) <= Number(previousAttempt?.overallScore ?? -1) ||
      (qa.hairOnly === "FAIL" && previousAttempt?.overallScore !== null)
    );

  const hindsightHistory = await recallRndHistory([
    `Draft My Hair R&D historical outcomes for hairstyle ${job.target.hairstyleId ?? "unknown"}.`,
    `Target: ${job.target.targetKey}.`,
    `Current QA defect/refinement: ${rawRefinement ?? "no refinement requested"}.`,
    `Previous refinement strategy: ${previousAttempt?.refinementReason ?? "none"}.`,
    `Repeated ineffective refinement detected: ${repeatedIneffectiveRefinement ? "yes" : "no"}.`,
    "Find prior successful or failed refinement strategies and recurring defects. Return historical evidence only; do not invent a new prompt.",
  ].join(" "));

  const qaWithMemory = {
    ...qa,
    imageIntegrity,
    finalVerification: finalVerification
      ? {
          verdict: finalVerification.verdict,
          overall: finalVerification.overall,
          identity: finalVerification.identity,
          styleAccuracy: finalVerification.styleAccuracy,
          rootIntegration: finalVerification.rootIntegration,
          lightingConsistency: finalVerification.lightingConsistency,
          hairOnly: finalVerification.hairOnly,
          artifacts: finalVerification.artifacts,
          reason: finalVerification.reason,
          refinement: finalVerification.refinement,
        }
      : null,
    hindsight: {
      enabled: hindsightEnabled(),
      recalledCount: hindsightHistory.length,
      recalled: hindsightHistory,
    },
    adaptiveRefinement: {
      previousAttemptNumber: previousAttempt?.attemptNumber ?? null,
      sameRefinementAsPrevious,
      repeatedRefinementCount,
      repeatedIneffectiveRefinement,
      fallbackToAuthoritativePrompt: Boolean(repeatedIneffectiveRefinement),
    },
  };

  // Never apply the same refinement again when the previous application failed to
  // improve the measured outcome. In that case, sample the immutable authoritative
  // prompt again rather than spending another attempt on a known ineffective edit.
  const refinementCandidate = repeatedIneffectiveRefinement ? null : rawRefinement;
  const authoritativePromptBuild = await buildRndPrompt({ prompt });
  const refinementBuild = refinementCandidate
    ? await buildRndPrompt({ prompt, refinement: refinementCandidate })
    : null;
  const refinementApplied = refinementBuild
    ? "refinementApplied" in refinementBuild.diagnostics && refinementBuild.diagnostics.refinementApplied
    : false;
  const refinement = refinementApplied ? refinementCandidate : null;

  const finalResult = await prisma.$transaction(async (tx) => {
    await tx.rnDAttempt.update({
      where: { jobId_attemptNumber: { jobId, attemptNumber } },
      data: {
        prompt,
        promptRevision: revision,
        generationStartedAt,
        generationCompletedAt,
        artifactId,
        qaJson: qaWithMemory,
        overallScore: qa.overall,
        aiGatePassed: hardPass,
        publicationTierPassed: hardPass,
        verdict: hardPass ? "HUMAN_APPROVAL" : "REFINE",
        refinementSlot: hardPass ? null : refinement ? "AUTO_" + attemptNumber : null,
        refinementReason: hardPass ? null : rawRefinement,
        errorCode: null,
        errorMessage: null,
      },
    });

    if (hardPass) {
      const updatedJob = await tx.rnDJob.update({
        where: { id: jobId },
        data: { status: "HUMAN_APPROVAL", attemptCount: attemptNumber, leaseOwner: null, leaseExpiresAt: null, heartbeatAt: now, completedAt: null, failureCode: null, failureMessage: null },
        select: { id: true, status: true, attemptCount: true },
      });
      await tx.rnDTarget.update({ where: { id: job.targetId }, data: { status: "HUMAN_APPROVAL" } });
      return { job: updatedJob, action: "HUMAN_APPROVAL" as const };
    }

    if (refinement) {
      if (!refinementBuild) throw new Error("R&D refinement build is missing.");
      const rebuilt = refinementBuild;
      // Do not impose a fixed convergence delay. The local worker's profile
      // manager remains the rate/quota gate for the next generation.
      const nextEligibleAt = new Date();
      const updatedJob = await tx.rnDJob.update({
        where: { id: jobId },
        data: { status: "QUEUED", currentPrompt: rebuilt.prompt, promptVersionNumber: attemptNumber + 1, attemptCount: attemptNumber, nextEligibleAt, leaseOwner: null, leaseExpiresAt: null, heartbeatAt: now, completedAt: null },
        select: { id: true, status: true, attemptCount: true, nextEligibleAt: true },
      });
      await tx.rnDTarget.update({ where: { id: job.targetId }, data: { status: "QUEUED" } });
      return { job: updatedJob, action: "REFINE" as const };
    }

    // R&D is convergence-driven, not attempt-count-driven. If QA does not produce
    // a safe targeted refinement, keep sampling the authoritative prompt instead of
    // declaring the job exhausted. A successful hard-pass remains the only autonomous
    // exit; human approval remains mandatory before promotion.
    // No safe refinement: immediately resample the immutable authoritative
    // prompt. Profile cooldowns and hourly limits are enforced by the worker.
    const nextEligibleAt = new Date();
    const updatedJob = await tx.rnDJob.update({
      where: { id: jobId },
      data: {
        status: "QUEUED",
        currentPrompt: authoritativePromptBuild.prompt,
        promptVersionNumber: attemptNumber + 1,
        attemptCount: attemptNumber,
        nextEligibleAt,
        leaseOwner: null,
        leaseExpiresAt: null,
        heartbeatAt: now,
        completedAt: null,
        failureCode: null,
        failureMessage: null,
      },
      select: { id: true, status: true, attemptCount: true, nextEligibleAt: true },
    });
    await tx.rnDTarget.update({ where: { id: job.targetId }, data: { status: "QUEUED" } });
    return { job: updatedJob, action: "REFINE" as const };
  });

  const scoredAttempts = await prisma.rnDAttempt.findMany({
    where: {
      jobId,
      overallScore: { not: null },
      artifactId: { not: null },
    },
    orderBy: { overallScore: "desc" },
    select: {
      id: true,
      attemptNumber: true,
      overallScore: true,
      qaJson: true,
      artifactId: true,
      generationCompletedAt: true,
    },
  });

  const candidateAttempts = scoredAttempts.filter((attempt) => {
    if (!attempt.artifactId || !attempt.qaJson || typeof attempt.qaJson !== "object" || Array.isArray(attempt.qaJson)) return false;
    const qaRecord = attempt.qaJson as Record<string, unknown>;
    return qaRecord.hairOnly === "PASS" && qaRecord.artifacts === "NONE";
  });

  const bestAttempt = candidateAttempts
    .slice()
    .sort((a, b) => {
      const score = (attempt: typeof a) => {
        const qaRecord = attempt.qaJson as Record<string, unknown>;
        return [
          Number(attempt.overallScore ?? -1),
          Number(qaRecord.styleAccuracy ?? -1),
          Number(qaRecord.identity ?? -1),
          Number(qaRecord.rootIntegration ?? -1),
          Number(qaRecord.lightingConsistency ?? -1),
        ];
      };
      const aScore = score(a);
      const bScore = score(b);
      for (let index = 0; index < aScore.length; index += 1) {
        if (aScore[index] !== bScore[index]) return bScore[index] - aScore[index];
      }
      return b.attemptNumber - a.attemptNumber;
    })[0] ?? null;

  const finalAttempt = await prisma.rnDAttempt.findUnique({
    where: { jobId_attemptNumber: { jobId, attemptNumber } },
    select: { id: true },
  });
  if (finalAttempt) {
    await retainRndOutcome({
      jobId,
      attemptId: finalAttempt.id,
      attemptNumber,
      targetKey: job.target.targetKey,
      hairstyleId: job.target.hairstyleId,
      prompt,
      verdict: finalResult.action === "HUMAN_APPROVAL" ? "HUMAN_APPROVAL" : finalResult.action,
      overallScore: Number(qa.overall),
      identityScore: Number(qa.identity),
      styleAccuracy: Number(qa.styleAccuracy),
      rootIntegration: Number(qa.rootIntegration),
      lightingConsistency: Number(qa.lightingConsistency),
      hairOnly: qa.hairOnly,
      artifacts: qa.artifacts,
      refinement: rawRefinement,
      refinementApplied,
    });
  }

  return NextResponse.json({
    ok: true,
    job: finalResult.job,
    action: finalResult.action,
    qa: qaWithMemory,
    bestCandidate: bestAttempt
      ? {
          attemptId: bestAttempt.id,
          attemptNumber: bestAttempt.attemptNumber,
          overall: Number(bestAttempt.overallScore),
          identity: scoreFromQaJson(bestAttempt.qaJson, "identity"),
          styleAccuracy: scoreFromQaJson(bestAttempt.qaJson, "styleAccuracy"),
          rootIntegration: scoreFromQaJson(bestAttempt.qaJson, "rootIntegration"),
          lightingConsistency: scoreFromQaJson(bestAttempt.qaJson, "lightingConsistency"),
          hairOnly: (bestAttempt.qaJson as Record<string, unknown>).hairOnly ?? null,
          artifacts: (bestAttempt.qaJson as Record<string, unknown>).artifacts ?? null,
          artifactId: bestAttempt.artifactId,
          generationCompletedAt: bestAttempt.generationCompletedAt,
        }
      : null,
  });
}

export async function GET(request: Request) {
  const authResponse = requireRndWorker(request.headers.get("authorization"));
  if (authResponse) return authResponse;

  const jobId = new URL(request.url).searchParams.get("jobId")?.trim();
  if (!jobId) return NextResponse.json({ error: "jobId is required" }, { status: 400 });

  const job = await prisma.rnDJob.findUnique({
    where: { id: jobId },
    select: {
      id: true,
      status: true,
      attemptCount: true,
      targetId: true,
      completedAt: true,
      failureCode: true,
      failureMessage: true,
      currentPrompt: true,
      attempts: {
        orderBy: { attemptNumber: "desc" },
        select: {
          id: true,
          attemptNumber: true,
          verdict: true,
          overallScore: true,
          aiGatePassed: true,
          publicationTierPassed: true,
          qaJson: true,
          refinementSlot: true,
          refinementReason: true,
          errorCode: true,
          errorMessage: true,
          artifactId: true,
          generationStartedAt: true,
          generationCompletedAt: true,
        },
      },
    },
  });

  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const eligibleAttempts = job.attempts.filter((attempt) => {
    if (!attempt.artifactId || !attempt.qaJson || typeof attempt.qaJson !== "object" || Array.isArray(attempt.qaJson)) return false;
    const qaRecord = attempt.qaJson as Record<string, unknown>;
    return qaRecord.hairOnly === "PASS" && qaRecord.artifacts === "NONE" && attempt.overallScore !== null;
  });

  const bestCandidate = eligibleAttempts
    .slice()
    .sort((a, b) => {
      const value = (attempt: typeof a) => {
        const qaRecord = attempt.qaJson as Record<string, unknown>;
        return [
          Number(attempt.overallScore ?? -1),
          Number(qaRecord.styleAccuracy ?? -1),
          Number(qaRecord.identity ?? -1),
          Number(qaRecord.rootIntegration ?? -1),
          Number(qaRecord.lightingConsistency ?? -1),
        ];
      };
      const aValue = value(a);
      const bValue = value(b);
      for (let index = 0; index < aValue.length; index += 1) {
        if (aValue[index] !== bValue[index]) return bValue[index] - aValue[index];
      }
      return b.attemptNumber - a.attemptNumber;
    })[0] ?? null;

  return NextResponse.json({
    ok: true,
    job,
    bestCandidate: bestCandidate
      ? {
          attemptId: bestCandidate.id,
          attemptNumber: bestCandidate.attemptNumber,
          overall: Number(bestCandidate.overallScore),
          identity: scoreFromQaJson(bestCandidate.qaJson, "identity"),
          styleAccuracy: scoreFromQaJson(bestCandidate.qaJson, "styleAccuracy"),
          rootIntegration: scoreFromQaJson(bestCandidate.qaJson, "rootIntegration"),
          lightingConsistency: scoreFromQaJson(bestCandidate.qaJson, "lightingConsistency"),
          hairOnly: (bestCandidate.qaJson as Record<string, unknown>).hairOnly ?? null,
          artifacts: (bestCandidate.qaJson as Record<string, unknown>).artifacts ?? null,
          artifactId: bestCandidate.artifactId,
          generationCompletedAt: bestCandidate.generationCompletedAt,
        }
      : null,
  });
}
