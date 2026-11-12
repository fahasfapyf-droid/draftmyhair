import { generationBudget, infrastructureRetryable, infrastructureBackoff, MAX_TARGETED_REFINEMENTS, MAX_INFRASTRUCTURE_RETRIES as MAX_RND_INFRASTRUCTURE_RETRIES } from "@/lib/rnd/retry-policy";
import { chooseRndRefinement } from "@/lib/rnd/refinement-learning";
import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { requireRndWorker } from "@/lib/rnd/worker-auth";
import { requireRndBlobToken } from "@/lib/rnd/blob-storage";
import { fetchRndSourceAsset } from "@/lib/rnd/source-asset";
import { runRndFinalVerification, runRndQa } from "@/lib/rnd/qa";
import { buildRndPrompt } from "@/lib/rnd/prompt";
import { hindsightEnabled, recallRndHistoryDetailed, retainRndOutcome } from "@/lib/rnd/hindsight";
import { passesRndHardIntegrityGate, runRndImageIntegrityCheck } from "@/lib/rnd/image-integrity";
import { passesRndCombinedHardGate } from "@/lib/rnd/qa-hard-gate";
import { fenceRndReportLease, hasValidRndLeaseExpiry, validateRndClaimGeneration } from "@/lib/rnd/report-lease-fence";

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
  claimGeneration?: unknown;
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

async function fetchPrivateArtifact(blobUrl: string, mimeType: string, checksum: string | null, fileSize: number) {
  const token = requireRndBlobToken();
  if (!token) throw new Error("Blob storage is not configured for R&D QA.");
  const response = await fetch(blobUrl, {
    redirect: "error",
    headers: { Authorization: "Bearer " + token },
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error("R&D artifact could not be retrieved for QA.");
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length !== fileSize || !/^[a-f0-9]{64}$/.test(checksum ?? "") || createHash("sha256").update(buffer).digest("hex") !== checksum) throw new Error("RND_QA_ARTIFACT_INTEGRITY_MISMATCH");
  return { buffer, mimeType };
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

  let generationStartedAt = dateOrNull(body.generationStartedAt);
  let generationCompletedAt = dateOrNull(body.generationCompletedAt);
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
      maxGenerationAttempts: true, refinementCount: true, infrastructureRetryCount: true,
      status: true,
      leaseOwner: true,
      leaseExpiresAt: true,
      startedAt: true,
      currentPrompt: true,
      target: { select: { targetKey: true, hairstyleId: true, sourceAsset: { select: { storageKey: true, blobUrl: true, mimeType: true, fileSize: true, checksum: true } } } },
    },
  });
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  // Failed jobs require a separately authorized administrative recovery path.
  // Worker credentials alone must never turn a terminal job back into QUEUED,
  // even when a stale worker knows the job ID.
  if (body.requeueFailed === true) {
    return NextResponse.json({ error: "Failed-job recovery requires administrative authorization" }, { status: 409 });
  }
  const submittedGeneration = validateRndClaimGeneration(body.claimGeneration, job.startedAt);
  if (submittedGeneration.status === "invalid") {
    return NextResponse.json({ error: "A valid claimGeneration is required" }, { status: 400 });
  }
  if (submittedGeneration.status === "stale") {
    return NextResponse.json({ error: "Job claim generation is no longer current" }, { status: 409 });
  }
  const leaseValidationTime = new Date();
  if (job.leaseOwner !== workerId || !hasValidRndLeaseExpiry(job.leaseExpiresAt, leaseValidationTime) || job.status !== "PROCESSING") {
    return NextResponse.json({ error: "Job lease is no longer valid" }, { status: 409 });
  }
  if (attemptNumber !== job.attemptCount + 1) {
    return NextResponse.json({ error: "Unexpected attempt number", expectedAttemptNumber: job.attemptCount + 1 }, { status: 409 });
  }
  const reservation = await prisma.rnDAttempt.findUnique({
    where: { jobId_attemptNumber: { jobId, attemptNumber } },
    select: { id: true, submittedAt: true, artifactId: true, verdict: true, generationStartedAt: true, generationCompletedAt: true, errorCode: true, promptRevision: true },
  });
  if (!reservation) return NextResponse.json({ error: "Attempt reservation not found" }, { status: 409 });
  if (reservation.promptRevision !== "reserved-v2") return NextResponse.json({ code: "RND_SUBMISSION_REQUIRES_RECONCILIATION" }, { status: 409 });
  if (reservation.errorCode !== "RND_SUBMITTED" || !reservation.submittedAt) return NextResponse.json({ code: "RND_SUBMISSION_NOT_RECORDED" }, { status: 409 });
  if (reservation.generationStartedAt && !artifactId) return NextResponse.json({ code: "RND_SUBMISSION_REQUIRES_RECONCILIATION" }, { status: 409 });
  if (artifactId && (!reservation.generationCompletedAt || reservation.artifactId !== artifactId)) return NextResponse.json({ code: "RND_REPORT_ARTIFACT_NOT_RECORDED" }, { status: 409 });
  if (artifactId) {
    generationStartedAt = reservation.generationStartedAt;
    generationCompletedAt = reservation.generationCompletedAt;
  }
  const reportFence = {
    jobId,
    workerId,
    claimStartedAt: submittedGeneration.generation,
    expectedAttemptCount: attemptNumber - 1,
    attemptId: reservation.id,
    attemptNumber,
  };
  if (attemptNumber > generationBudget(job.maxGenerationAttempts) || job.infrastructureRetryCount > MAX_RND_INFRASTRUCTURE_RETRIES) {
    const infrastructureExhausted = job.infrastructureRetryCount > MAX_RND_INFRASTRUCTURE_RETRIES;
    const code = infrastructureExhausted ? "RND_INFRASTRUCTURE_RETRY_LIMIT" : "RND_CONVERGENCE_LIMIT";
    const message = infrastructureExhausted ? "R&D infrastructure retry budget exhausted." : `R&D generation budget of ${generationBudget(job.maxGenerationAttempts)} exhausted.`;
    const committed = await prisma.$transaction(async (tx) => {
      if (!(await fenceRndReportLease(tx, reportFence))) return false;
      await tx.rnDAttempt.update({ where: { jobId_attemptNumber: { jobId, attemptNumber } }, data: { verdict: "FAILED", errorCode: code, errorMessage: message } });
      await tx.rnDJob.update({ where: { id: jobId }, data: { status: "FAILED", attemptCount: attemptNumber, leaseOwner: null, leaseExpiresAt: null, completedAt: now, failureCode: code, failureMessage: message } });
      await tx.rnDTarget.update({ where: { id: job.targetId }, data: { status: "FAILED" } });
      return true;
    });
    if (!committed) return NextResponse.json({ error: "Job lease changed before report commit" }, { status: 409 });
    return NextResponse.json({ ok: true, jobId, attemptNumber, status: "FAILED", code, maxAttempts: generationBudget(job.maxGenerationAttempts) });
  }
  if (reservation.artifactId && reservation.artifactId !== artifactId) return NextResponse.json({ error: "Artifact does not belong to this R&D attempt" }, { status: 409 });

  // Submission is already recorded here. Quota claims cannot authorize deleting
  // the reservation or redispatching an uncertain generation.
  if (errorCode === "GEMINI_PROFILE_EXHAUSTED") {
    return NextResponse.json({ code: "RND_SUBMISSION_REQUIRES_RECONCILIATION" }, { status: 409 });
  }

  const prompt = job.currentPrompt;
  const revision = promptRevision(prompt);
  const succeeded = !errorCode && !errorMessage && Boolean(generationCompletedAt) && Boolean(artifactId);

  if (!succeeded) {
    // Dispatched/uncertain generations are never blindly regenerated.
    const result = await prisma.$transaction(async (tx) => {
      if (!(await fenceRndReportLease(tx, reportFence))) return null;
      const attempt = await tx.rnDAttempt.update({
        where: { jobId_attemptNumber: { jobId, attemptNumber } },
        data: { prompt, promptRevision: revision, generationStartedAt, generationCompletedAt, artifactId: null, verdict: "FAILED", errorCode, errorMessage },
      });
      await tx.rnDJob.update({
        where: { id: jobId },
        data: { status: "FAILED", attemptCount: attemptNumber, leaseOwner: null, leaseExpiresAt: null, completedAt: now, failureCode: errorCode || "RND_GENERATION_FAILED", failureMessage: errorMessage || "Generation did not produce a verified artifact." },
      });
      await tx.rnDTarget.update({ where: { id: job.targetId }, data: { status: "FAILED" } });
      return attempt;
    });
    if (!result) return NextResponse.json({ error: "Job lease changed before report commit" }, { status: 409 });
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
      status: "FAILED",
      action: "FAILED",
    });
  }

  if (!artifactId) return NextResponse.json({ error: "artifactId is required for a successful report" }, { status: 400 });

  const artifact = await prisma.rnDAsset.findUnique({
    where: { id: artifactId },
    select: { id: true, kind: true, storageKey: true, blobUrl: true, mimeType: true, checksum: true, fileSize: true },
  });
  if (!artifact) return NextResponse.json({ error: "Artifact not found" }, { status: 404 });
  if (artifact.kind !== "GENERATED" || !artifact.storageKey.startsWith(`rnd/attempts/${jobId}/${attemptNumber}-`)) {
    return NextResponse.json({ error: "Artifact is not a generated asset for this job and attempt" }, { status: 409 });
  }
  if (!artifact.blobUrl || !artifact.mimeType) return NextResponse.json({ error: "Artifact is missing blob URL or MIME type" }, { status: 422 });

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



  let qa;
  let finalVerification = null;
  let imageIntegrity = null;
  try {
    const [source, generated] = await Promise.all([
      fetchRndSourceAsset(job.target.sourceAsset, request.url, request.headers.get("x-vercel-protection-bypass")),
      fetchPrivateArtifact(artifact.blobUrl, artifact.mimeType, artifact.checksum, artifact.fileSize),
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
    const retryableInfrastructureFailure = infrastructureRetryable(error);
    if (retryableInfrastructureFailure) {
      const retryAt = new Date(Date.now() + infrastructureBackoff((job.infrastructureRetryCount ?? 0) + 1));
      const committed = await prisma.$transaction(async (tx) => {
        if (!(await fenceRndReportLease(tx, reportFence))) return null;

        // Increment inside the fenced transaction: stale reports cannot consume
        // retry budget. Both attempt and job counters survive worker crashes.
        const retryRows = await tx.$queryRaw<Array<{ infrastructureRetryCount: number }>>`
          UPDATE "RnDAttempt"
          SET "infrastructureRetryCount" = "infrastructureRetryCount" + 1
          WHERE "id" = ${reservation.id}
            AND "jobId" = ${jobId}
            AND "attemptNumber" = ${attemptNumber}
          RETURNING "infrastructureRetryCount"
        `;
        if (retryRows.length !== 1) {
          throw new Error("Could not increment the infrastructure retry counter for the fenced attempt.");
        }

        const jobRetry = await tx.rnDJob.update({ where: { id: jobId }, data: { infrastructureRetryCount: { increment: 1 } }, select: { infrastructureRetryCount: true } });
        const infrastructureRetryCount = Math.max(Number(retryRows[0].infrastructureRetryCount), jobRetry.infrastructureRetryCount);
        if (infrastructureRetryCount > MAX_RND_INFRASTRUCTURE_RETRIES) {
          const message = `R&D stopped after ${MAX_RND_INFRASTRUCTURE_RETRIES} infrastructure retries for automated QA.`;
          await tx.rnDAttempt.update({
            where: { id: reservation.id },
            data: {
              verdict: "FAILED",
              errorCode: "RND_INFRASTRUCTURE_RETRY_LIMIT",
              errorMessage: message,
            },
          });
          await tx.rnDJob.update({
            where: { id: jobId },
            data: {
              status: "FAILED",
              attemptCount: attemptNumber,
              leaseOwner: null,
              leaseExpiresAt: null,
              completedAt: now,
              failureCode: "RND_INFRASTRUCTURE_RETRY_LIMIT",
              failureMessage: message,
            },
          });
          await tx.rnDTarget.update({ where: { id: job.targetId }, data: { status: "FAILED" } });
          return { infrastructureRetryCount, exhausted: true as const };
        }

        await tx.rnDJob.update({
          where: { id: jobId },
          data: {
            status: "QUEUED",
            attemptCount: attemptNumber - 1,
            nextEligibleAt: retryAt,
            leaseOwner: null,
            leaseExpiresAt: null,
            completedAt: null,
            failureCode: null,
            failureMessage: null,
          },
        });
        await tx.rnDTarget.update({ where: { id: job.targetId }, data: { status: "QUEUED" } });
        return { infrastructureRetryCount, exhausted: false as const };
      });
      if (!committed) return NextResponse.json({ error: "Job lease changed before report commit" }, { status: 409 });
      if (committed.exhausted) {
        await retainRndOutcome({ jobId, attemptId: reservation.id, attemptNumber, targetKey: job.target.targetKey, hairstyleId: job.target.hairstyleId, prompt, verdict: "FAILED", overallScore: null, identityScore: null, styleAccuracy: null, rootIntegration: null, lightingConsistency: null, hairOnly: null, artifacts: null, refinement: null, refinementApplied: false, failureCode: "RND_INFRASTRUCTURE_RETRY_LIMIT" });
        return NextResponse.json({
          ok: true,
          jobId,
          attemptNumber,
          status: "FAILED",
          action: "INFRASTRUCTURE_RETRY_LIMIT_REACHED",
          infrastructureRetryCount: committed.infrastructureRetryCount,
          maxInfrastructureRetries: MAX_RND_INFRASTRUCTURE_RETRIES,
        });
      }
      return NextResponse.json({
        ok: true,
        jobId,
        attemptNumber,
        status: "QUEUED",
        action: "RETRY_QA_INFRASTRUCTURE",
        infrastructureRetryCount: committed.infrastructureRetryCount,
        maxInfrastructureRetries: MAX_RND_INFRASTRUCTURE_RETRIES,
        nextEligibleAt: retryAt.toISOString(),
      });
    }
    const committed = await prisma.$transaction(async tx => {
      if (!(await fenceRndReportLease(tx, reportFence))) return false;
      await tx.rnDAttempt.update({ where: { id: reservation.id }, data: { verdict: "FAILED", errorCode: "RND_QA_TERMINAL", errorMessage: "Non-retryable QA evaluation failure." } });
      await tx.rnDJob.update({ where: { id: jobId }, data: { status: "FAILED", attemptCount: attemptNumber, leaseOwner: null, leaseExpiresAt: null, completedAt: now, failureCode: "RND_QA_TERMINAL", failureMessage: "Non-retryable QA evaluation failure." } });
      await tx.rnDTarget.update({ where: { id: job.targetId }, data: { status: "FAILED" } });
      return true;
    });
    if (!committed) return NextResponse.json({ error: "Job lease changed before report commit" }, { status: 409 });
    await retainRndOutcome({ jobId, attemptId: reservation.id, attemptNumber, targetKey: job.target.targetKey, hairstyleId: job.target.hairstyleId, prompt,
      verdict: "FAILED", overallScore: null, identityScore: null, styleAccuracy: null, rootIntegration: null, lightingConsistency: null, hairOnly: null, artifacts: null, refinement: null, refinementApplied: false, failureCode: "RND_QA_TERMINAL" });
    return NextResponse.json({ ok: true, status: "FAILED", code: "RND_QA_TERMINAL" });
  }

  const hardPass = passesRndCombinedHardGate({
    qa,
    imageIntegrity,
    finalVerification,
  });

  const rawRefinement = !hardPass
    ? (finalVerification?.verdict === "REJECT" && finalVerification.refinement.trim()
        ? finalVerification.refinement.trim()
        : qa.refinement.trim() || null)
    : null;

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

  // Recall AFTER independent current-image scoring, using the actual defect.
  const hindsightRecall = !hardPass ? await recallRndHistoryDetailed([
    "Draft My Hair historical hairstyle R&D evidence.",
    "Hairstyle first:", job.target.hairstyleId ?? "unknown",
    "Observed QA defect:", rawRefinement ?? qa.reason,
    "Retrieve comparable successful and failed refinements, identity preservation, hair-only integrity, root integration, and style accuracy.",
    "Target context (secondary):", job.target.targetKey,
    "Historical evidence is advisory only; never override current QA or protected identity constraints."
  ].join(" ").slice(0,2400)) : { evidence: [], status: "ok" as const, httpStatus: null };
  const hindsightHistory = hindsightRecall.evidence;
  const qaWithMemory = {
    ...qa,
    learning: { decision: "DETERMINISTIC_FALLBACK", evidenceIds: hindsightHistory.map(item => item.id) },
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
      status: hindsightRecall.status,
      httpStatus: hindsightRecall.httpStatus,
      recalledCount: hindsightHistory.length,
      recalled: hindsightHistory,
    },
    adaptiveRefinement: {
      previousAttemptNumber: previousAttempt?.attemptNumber ?? null,
      sameRefinementAsPrevious,
      repeatedRefinementCount,
      repeatedIneffectiveRefinement,
      stoppedIneffectiveRefinement: Boolean(repeatedIneffectiveRefinement),
    },
  };

  // Do not repeat an ineffective correction or resample indefinitely.
  const refinementCandidate = repeatedIneffectiveRefinement ? null : rawRefinement;
  const learned = await chooseRndRefinement(refinementCandidate, hindsightHistory);
  qaWithMemory.learning = { decision: learned.decision, evidenceIds: learned.evidenceIds };
  const refinementBuild = learned.candidate
    ? await buildRndPrompt({ prompt, refinement: learned.candidate })
    : null;
  const refinementApplied = refinementBuild
    ? "refinementApplied" in refinementBuild.diagnostics && refinementBuild.diagnostics.refinementApplied
    : false;
  const refinement = refinementApplied ? learned.candidate : null;

  const finalResult = await prisma.$transaction(async (tx) => {
    if (!(await fenceRndReportLease(tx, reportFence))) return null;
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
        data: { status: "HUMAN_APPROVAL", attemptCount: attemptNumber, leaseOwner: null, leaseExpiresAt: null, completedAt: null, failureCode: null, failureMessage: null },
        select: { id: true, status: true, attemptCount: true },
      });
      await tx.rnDTarget.update({ where: { id: job.targetId }, data: { status: "HUMAN_APPROVAL" } });
      return { job: updatedJob, action: "HUMAN_APPROVAL" as const };
    }

    if (attemptNumber >= generationBudget(job.maxGenerationAttempts) || (job.refinementCount ?? 0) >= MAX_TARGETED_REFINEMENTS || !refinement) {
      const code = attemptNumber >= generationBudget(job.maxGenerationAttempts) ? "RND_CONVERGENCE_LIMIT" : (job.refinementCount ?? 0) >= MAX_TARGETED_REFINEMENTS ? "RND_REFINEMENT_LIMIT" : "RND_NO_SAFE_REFINEMENT";
      await tx.rnDAttempt.update({ where: { id: reservation.id }, data: { verdict: "FAILED", errorCode: code } });
      const stopped = await tx.rnDJob.update({ where: { id: jobId }, data: { status: "FAILED", attemptCount: attemptNumber, leaseOwner: null, leaseExpiresAt: null, completedAt: now, failureCode: code, failureMessage: "R&D stopped without satisfying all hard gates; budget is never reset." }, select: { id: true, status: true, attemptCount: true } });
      await tx.rnDTarget.update({ where: { id: job.targetId }, data: { status: "FAILED" } });
      return { job: stopped, action: "FAILED" as const };
    }

    if (refinement) {
      if (!refinementBuild) throw new Error("R&D refinement build is missing.");
      const rebuilt = refinementBuild;
      // Do not impose a fixed convergence delay. The local worker's profile
      // manager remains the rate/quota gate for the next generation.
      const nextEligibleAt = new Date();
      const updatedJob = await tx.rnDJob.update({
        where: { id: jobId },
        data: { status: "QUEUED", refinementCount: { increment: 1 }, currentPrompt: rebuilt.prompt, promptVersionNumber: attemptNumber + 1, attemptCount: attemptNumber, nextEligibleAt, leaseOwner: null, leaseExpiresAt: null, completedAt: null },
        select: { id: true, status: true, attemptCount: true, nextEligibleAt: true },
      });
      await tx.rnDTarget.update({ where: { id: job.targetId }, data: { status: "QUEUED" } });
      return { job: updatedJob, action: "REFINE" as const };
    }

    throw new Error("RND_UNREACHABLE_REQUEUE");
  });
  if (!finalResult) return NextResponse.json({ error: "Job lease changed before report commit" }, { status: 409 });

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
      aiGatePassed: true,
      publicationTierPassed: true,
    },
  });

  const candidateAttempts = scoredAttempts.filter((attempt) => {
    if (!attempt.artifactId || !attempt.qaJson || typeof attempt.qaJson !== "object" || Array.isArray(attempt.qaJson)) return false;
    const qaRecord = attempt.qaJson as Record<string, unknown>;
    const verification = qaRecord.finalVerification as Record<string, unknown> | null | undefined;
    const integrity = qaRecord.imageIntegrity as Record<string, unknown> | null | undefined;
    return attempt.aiGatePassed === true && attempt.publicationTierPassed === true &&
      qaRecord.hairOnly === "PASS" && qaRecord.artifacts === "NONE" &&
      integrity != null && typeof integrity.canvasMatch === "boolean" &&
      passesRndHardIntegrityGate({ canvasMatch: integrity.canvasMatch, faceTexturePreservationPass: integrity.faceTexturePreservationPass }) &&
      verification?.verdict === "PASS" && Number(verification.overall) >= 9.5 &&
      Number(verification.identity) >= 9.5 && Number(verification.styleAccuracy) >= 9.5 &&
      Number(verification.rootIntegration) >= 9.5 && Number(verification.lightingConsistency) >= 9.5 &&
      verification.hairOnly === "PASS" && verification.artifacts === "NONE";
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
    const verification = qaRecord.finalVerification as Record<string, unknown> | null | undefined;
    const integrity = qaRecord.imageIntegrity as Record<string, unknown> | null | undefined;
    return attempt.aiGatePassed === true && attempt.publicationTierPassed === true &&
      qaRecord.hairOnly === "PASS" && qaRecord.artifacts === "NONE" && attempt.overallScore !== null &&
      integrity != null && typeof integrity.canvasMatch === "boolean" &&
      passesRndHardIntegrityGate({ canvasMatch: integrity.canvasMatch, faceTexturePreservationPass: integrity.faceTexturePreservationPass }) &&
      verification?.verdict === "PASS" && Number(verification.overall) >= 9.5 &&
      Number(verification.identity) >= 9.5 && Number(verification.styleAccuracy) >= 9.5 &&
      Number(verification.rootIntegration) >= 9.5 && Number(verification.lightingConsistency) >= 9.5 &&
      verification.hairOnly === "PASS" && verification.artifacts === "NONE";
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
