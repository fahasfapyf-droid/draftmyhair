import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRndWorker } from "@/lib/rnd/worker-auth";
import { runRndQa } from "@/lib/rnd/qa";
import { STYLE_PROMPTS } from "@/lib/engine/prompts/styles";
import { optimizeAutonomousPrompt } from "@/lib/rnd/autonomous-prompt";
import { decideAdaptiveRefinement } from "@/lib/rnd/adaptive-decision";
import { reconcileRndCampaignLifecycle } from "@/lib/rnd/campaign-lifecycle";

export const runtime = "nodejs";
const MAX_AUTONOMOUS_ATTEMPTS = Math.max(2, Number(process.env.RND_MAX_AUTONOMOUS_ATTEMPTS ?? 8));
const ONE_MINUTE_MS = 60 * 1000;
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
  if (attemptNumber > MAX_AUTONOMOUS_ATTEMPTS) return NextResponse.json({ error: "Maximum autonomous attempts exceeded" }, { status: 409 });

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
      failureCode: true,
      target: { select: { hairstyleId: true, hardCoreInstruction: true, campaignId: true, sourceAsset: { select: { blobUrl: true, mimeType: true } } } },
    },
  });
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const reservation = await prisma.rnDAttempt.findUnique({
    where: { jobId_attemptNumber: { jobId, attemptNumber } },
    select: { id: true, submittedAt: true, artifactId: true, verdict: true, qaJson: true, errorCode: true },
  });
  if (!reservation) return NextResponse.json({ error: "Attempt reservation not found" }, { status: 409 });

  if (
    attemptNumber === job.attemptCount &&
    artifactId &&
    reservation.artifactId === artifactId &&
    reservation.qaJson != null &&
    reservation.errorCode === null &&
    ["QUEUED", "HUMAN_REVIEW", "HUMAN_APPROVAL", "EXHAUSTED"].includes(job.status) &&
    job.failureCode === "WORKER_EXECUTION_ERROR"
  ) {
    await prisma.rnDJob.updateMany({
      where: {
        id: jobId,
        attemptCount: attemptNumber,
        status: job.status,
        failureCode: "WORKER_EXECUTION_ERROR",
      },
      data: { failureCode: null, failureMessage: null },
    });
    return NextResponse.json({ ok: true, jobId, attemptNumber, idempotent: true });
  }

  if (job.leaseOwner !== workerId || (job.leaseExpiresAt && job.leaseExpiresAt < now) || job.status !== "PROCESSING") {
    return NextResponse.json({ error: "Job lease is no longer valid" }, { status: 409 });
  }
  if (attemptNumber !== job.attemptCount + 1) {
    return NextResponse.json({ error: "Unexpected attempt number", expectedAttemptNumber: job.attemptCount + 1 }, { status: 409 });
  }

  if (reservation.artifactId) return NextResponse.json({ ok: true, jobId, attemptNumber, idempotent: true });

  const prompt = job.currentPrompt;
  const revision = promptRevision(prompt);
  const succeeded = !errorCode && !errorMessage && Boolean(generationCompletedAt) && Boolean(artifactId);

  if (!succeeded) {
    // Infrastructure/browser failures must not consume a hairstyle refinement
    // attempt. Requeue the same attempt so a transient Gemini UI failure can be
    // retried after the generation interval. Actual QA failures still consume
    // autonomous attempts and follow the normal refinement/exhaustion path.
    if (errorCode === "WORKER_EXECUTION_ERROR") {
      const retryAt = new Date(Date.now() + 60 * 1000);
      const result = await prisma.$transaction(async (tx) => {
        const attempt = await tx.rnDAttempt.update({
          where: { jobId_attemptNumber: { jobId, attemptNumber } },
          data: {
            prompt,
            promptRevision: revision,
            generationStartedAt,
            generationCompletedAt,
            artifactId: null,
            verdict: "REFINE",
            errorCode,
            errorMessage,
          },
        });
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
            failureCode: errorCode,
            failureMessage: errorMessage,
          },
        });
        await tx.rnDTarget.update({ where: { id: job.targetId }, data: { status: "QUEUED" } });
        return attempt;
      });
      return NextResponse.json({
        ok: true,
        jobId,
        attemptId: result.id,
        status: "QUEUED",
        retryAt: retryAt.toISOString(),
        infrastructureRetry: true,
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const attempt = await tx.rnDAttempt.update({
        where: { jobId_attemptNumber: { jobId, attemptNumber } },
        data: { prompt, promptRevision: revision, generationStartedAt, generationCompletedAt, artifactId: null, verdict: "FAILED", errorCode, errorMessage },
      });
      await tx.rnDJob.update({
        where: { id: jobId },
        data: { status: "FAILED", attemptCount: attemptNumber, leaseOwner: null, leaseExpiresAt: null, heartbeatAt: now, completedAt: null, failureCode: errorCode, failureMessage: errorMessage },
      });
      await tx.rnDTarget.update({ where: { id: job.targetId }, data: { status: "FAILED" } });
      return attempt;
    });
    return NextResponse.json({ ok: true, jobId, attemptId: result.id, status: "FAILED" });
  }

  const artifact = await prisma.rnDAsset.findUnique({
    where: { id: artifactId },
    select: { id: true, blobUrl: true, mimeType: true },
  });
  if (!artifact) return NextResponse.json({ error: "Artifact not found" }, { status: 404 });
  if (!artifact.blobUrl || !artifact.mimeType) return NextResponse.json({ error: "Artifact is missing blob URL or MIME type" }, { status: 422 });

  let qa;
  try {
    const [source, generated] = await Promise.all([
      fetchPrivateArtifact(job.target.sourceAsset.blobUrl, job.target.sourceAsset.mimeType),
      fetchPrivateArtifact(artifact.blobUrl, artifact.mimeType),
    ]);
    qa = await Promise.race([
      runRndQa(source.buffer, source.mimeType, generated.buffer, generated.mimeType, prompt),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Automated QA timed out.")), QA_TIMEOUT_MS)),
    ]);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Automated QA failed." }, { status: 503 });
  }

  const hardPass =
    qa.productionReady &&
    qa.transformationFloor >= 9.5 &&
    qa.hairOnly === "PASS" &&
    qa.rootIntegration >= 9.5 &&
    qa.transformationOnly === "PASS" &&
    qa.artifacts === "NONE" &&
    qa.transformationGate.passed;

  const refinement = !hardPass && qa.refinement.trim() ? qa.refinement.trim() : null;
  let adaptiveDecision = null as ReturnType<typeof decideAdaptiveRefinement> | null;
  let nextPrompt: string | null = null;
  let nextPromptDiagnostics: unknown = null;

  if (!hardPass && refinement) {
    const history = await prisma.rnDAttempt.findMany({
      where: { jobId },
      orderBy: { attemptNumber: "asc" },
      select: {
        attemptNumber: true,
        overallScore: true,
        aiGatePassed: true,
        verdict: true,
        refinementReason: true,
        qaJson: true,
        prompt: true,
        promptRevision: true,
        artifactId: true,
        adaptiveDecision: true,
      },
    });
    adaptiveDecision = decideAdaptiveRefinement({
      defect: refinement,
      qa,
      history: history.map((item) => ({
        attemptNumber: item.attemptNumber,
        overallScore: item.overallScore == null ? null : Number(item.overallScore),
        aiGatePassed: item.aiGatePassed,
        verdict: item.verdict,
        refinementReason: item.refinementReason,
        qaJson: item.qaJson,
        prompt: item.prompt,
        promptRevision: item.promptRevision,
        artifactId: item.artifactId,
        adaptiveDecision: item.adaptiveDecision,
      })),
      attemptNumber,
      maxAttempts: MAX_AUTONOMOUS_ATTEMPTS,
      currentPrompt: prompt,
      currentPromptRevision: revision,
      currentArtifactId: artifactId,
      currentAiGatePassed: hardPass,
    });

    if (adaptiveDecision.action === "REFINE" && adaptiveDecision.instruction && job.target.hairstyleId) {
      try {
        const hairstyle = await prisma.hairstyle.findUnique({
          where: { id: job.target.hairstyleId },
          select: { promptKey: true },
        });
        if (!hairstyle) throw new Error("R&D target hairstyle was not found.");
        const databaseStyle = await prisma.promptVersion.findFirst({
          where: { status: "ACTIVE", hairstyleId: job.target.hairstyleId },
          orderBy: { version: "desc" },
          select: { prompt: true, version: true },
        });
        const compiledStyle = STYLE_PROMPTS[hairstyle.promptKey]?.prompt;
        const authoritativeStylePrompt = databaseStyle?.prompt ?? compiledStyle;
        if (!authoritativeStylePrompt) throw new Error("Authoritative production prompt is missing for " + hairstyle.promptKey);

        const rebuilt = await optimizeAutonomousPrompt({
          instruction: job.target.hardCoreInstruction ?? "Validate the requested production hairstyle.",
          currentPrompt: prompt,
          defect: adaptiveDecision.instruction,
          attemptNumber,
          authoritativeStylePrompt,
          strategyId: adaptiveDecision.strategy,
        });
        nextPrompt = rebuilt.prompt;
        nextPromptDiagnostics = { ...rebuilt.diagnostics, adaptiveDecision };
      } catch (error) {
        return NextResponse.json(
          { error: error instanceof Error ? error.message : "Autonomous prompt optimization failed." },
          { status: 503 },
        );
      }
    }
  }

  const finalResult = await prisma.$transaction(async (tx) => {
    await tx.rnDAttempt.update({
      where: { jobId_attemptNumber: { jobId, attemptNumber } },
      data: {
        prompt,
        promptRevision: revision,
        generationStartedAt,
        generationCompletedAt,
        artifactId,
        qaJson: qa,
        overallScore: qa.overall,
        aiGatePassed: hardPass,
        publicationTierPassed: hardPass,
        verdict: hardPass ? "HUMAN_APPROVAL" : adaptiveDecision?.action === "HUMAN_REVIEW" ? "HUMAN_REVIEW" : adaptiveDecision?.action === "REFINE" && nextPrompt ? "REFINE" : "EXHAUSTED",
        refinementSlot: hardPass ? null : adaptiveDecision?.action === "REFINE" && nextPrompt ? `AUTO_${attemptNumber}` : null,
        refinementReason: hardPass ? null : adaptiveDecision?.reason ?? refinement,
        adaptiveDecision: adaptiveDecision ?? undefined,
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
      const campaignStatus = await reconcileRndCampaignLifecycle(tx, job.target.campaignId);
      return { job: updatedJob, action: "HUMAN_APPROVAL" as const, promptDiagnostics: null, campaignStatus };
    }

    if (adaptiveDecision?.action === "HUMAN_REVIEW") {
      const updatedJob = await tx.rnDJob.update({
        where: { id: jobId },
        data: { status: "HUMAN_REVIEW", attemptCount: attemptNumber, leaseOwner: null, leaseExpiresAt: null, heartbeatAt: now, completedAt: null, failureCode: null, failureMessage: null },
        select: { id: true, status: true, attemptCount: true },
      });
      await tx.rnDTarget.update({ where: { id: job.targetId }, data: { status: "HUMAN_REVIEW" } });
      return { job: updatedJob, action: "HUMAN_REVIEW" as const, promptDiagnostics: nextPromptDiagnostics, campaignStatus: null };
    }

    if (adaptiveDecision?.action === "REFINE" && nextPrompt) {
      const nextEligibleAt = new Date(Date.now() + ONE_MINUTE_MS);
      const updatedJob = await tx.rnDJob.update({
        where: { id: jobId },
        data: {
          status: "QUEUED",
          currentPrompt: nextPrompt,
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
      return { job: updatedJob, action: "REFINE" as const, promptDiagnostics: nextPromptDiagnostics };
    }

    const updatedJob = await tx.rnDJob.update({
      where: { id: jobId },
      data: { status: "EXHAUSTED", attemptCount: attemptNumber, leaseOwner: null, leaseExpiresAt: null, heartbeatAt: now, completedAt: now, failureCode: null, failureMessage: null },
      select: { id: true, status: true, attemptCount: true },
    });
    await tx.rnDTarget.update({ where: { id: job.targetId }, data: { status: "EXHAUSTED" } });
    const campaignStatus = await reconcileRndCampaignLifecycle(tx, job.target.campaignId);
    return { job: updatedJob, action: "EXHAUSTED" as const, promptDiagnostics: null, campaignStatus };
  });

  return NextResponse.json({ ok: true, job: finalResult.job, action: finalResult.action, campaignStatus: finalResult.campaignStatus ?? null, qa, promptDiagnostics: finalResult.promptDiagnostics });
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
          adaptiveDecision: true,
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
  return NextResponse.json({ ok: true, job });
}
