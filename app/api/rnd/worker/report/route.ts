import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRndWorker } from "@/lib/rnd/worker-auth";
import { runRndQa } from "@/lib/rnd/qa";
import { buildRndPrompt } from "@/lib/rnd/prompt";

export const runtime = "nodejs";
const MAX_AUTONOMOUS_ATTEMPTS = 2;
const FIVE_MINUTES_MS = 5 * 60 * 1000;

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
  const response = await fetch(blobUrl, { headers: { Authorization: "Bearer " + token }, cache: "no-store" });
  if (!response.ok) throw new Error("Generated artifact could not be retrieved for QA.");
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
  const submittedAt = dateOrNull(body.submittedAt) ?? new Date();
  const artifactId = typeof body.artifactId === "string" ? body.artifactId : null;
  const errorCode = typeof body.errorCode === "string" ? body.errorCode : null;
  const errorMessage = typeof body.errorMessage === "string" ? body.errorMessage : null;
  const now = new Date();

  const job = await prisma.rnDJob.findUnique({
    where: { id: jobId },
    select: { id: true, targetId: true, attemptCount: true, status: true, leaseOwner: true, leaseExpiresAt: true, currentPrompt: true, target: { select: { hairstyleId: true } } },
  });
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  if (job.leaseOwner !== workerId || (job.leaseExpiresAt && job.leaseExpiresAt < now) || job.status !== "PROCESSING") {
    return NextResponse.json({ error: "Job lease is no longer valid" }, { status: 409 });
  }
  if (attemptNumber !== job.attemptCount + 1) return NextResponse.json({ error: "Unexpected attempt number", expectedAttemptNumber: job.attemptCount + 1 }, { status: 409 });

  const succeeded = !errorCode && !errorMessage && Boolean(generationCompletedAt) && Boolean(artifactId);
  const prompt = job.currentPrompt;
  const revision = promptRevision(prompt);

  if (!succeeded) {
    const result = await prisma.$transaction(async (tx) => {
      await tx.rnDAttempt.create({ data: { jobId, attemptNumber, prompt, promptRevision: revision, submittedAt, generationStartedAt, generationCompletedAt, artifactId: null, verdict: "FAILED", errorCode, errorMessage } });
      const updatedJob = await tx.rnDJob.update({
        where: { id: jobId },
        data: { status: "FAILED", attemptCount: attemptNumber, leaseOwner: null, leaseExpiresAt: null, heartbeatAt: now, completedAt: null, failureCode: errorCode, failureMessage: errorMessage },
        select: { id: true, status: true, attemptCount: true },
      });
      await tx.rnDTarget.update({ where: { id: job.targetId }, data: { status: "FAILED" } });
      return updatedJob;
    });
    return NextResponse.json({ ok: true, job: result });
  }

  if (!artifactId) {
    return NextResponse.json({ error: "Artifact ID is required for a successful report" }, { status: 400 });
  }

  const artifact = await prisma.rnDAsset.findUnique({ where: { id: artifactId }, select: { id: true, blobUrl: true, mimeType: true } });
  if (!artifact) return NextResponse.json({ error: "Artifact not found" }, { status: 404 });
  if (!artifact.blobUrl || !artifact.mimeType) {
    return NextResponse.json({ error: "Artifact is missing blob URL or MIME type" }, { status: 422 });
  }

  let qa;
  try {
    const image = await fetchPrivateArtifact(artifact.blobUrl, artifact.mimeType);
    qa = await runRndQa(image.buffer, image.mimeType, prompt);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Automated QA failed." }, { status: 503 });
  }

  const hardPass =
    qa.verdict === "APPROVE" &&
    qa.overall >= 9.5 &&
    qa.identity >= 9.5 &&
    qa.styleAccuracy >= 9.5 &&
    qa.rootIntegration >= 9.5 &&
    qa.lightingConsistency >= 9.5 &&
    qa.hairOnly === "PASS" &&
    qa.artifacts === "NONE";

  const refinement = !hardPass && qa.refinement.trim() ? qa.refinement.trim() : null;
  const finalResult = await prisma.$transaction(async (tx) => {
    await tx.rnDAttempt.create({
      data: {
        jobId,
        attemptNumber,
        prompt,
        promptRevision: revision,
        submittedAt,
        generationStartedAt,
        generationCompletedAt,
        artifactId,
        qaJson: qa,
        overallScore: qa.overall,
        aiGatePassed: hardPass,
        publicationTierPassed: hardPass,
        verdict: hardPass ? "HUMAN_APPROVAL" : attemptNumber < MAX_AUTONOMOUS_ATTEMPTS && refinement ? "REFINE" : "EXHAUSTED",
        refinementSlot: hardPass ? null : attemptNumber < MAX_AUTONOMOUS_ATTEMPTS && refinement ? "AUTO_1" : null,
        refinementReason: hardPass ? null : refinement,
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

    if (attemptNumber < MAX_AUTONOMOUS_ATTEMPTS && refinement) {
      const target = await tx.rnDTarget.findUniqueOrThrow({ where: { id: job.targetId }, select: { hairstyle: { select: { promptKey: true } } } });
      if (!target.hairstyle) throw new Error("R&D target hairstyle is missing.");
      const rebuilt = await buildRndPrompt({ promptKey: target.hairstyle.promptKey, refinement });
      const nextEligibleAt = new Date(Math.max(Date.now() + FIVE_MINUTES_MS, submittedAt.getTime() + FIVE_MINUTES_MS));
      const updatedJob = await tx.rnDJob.update({
        where: { id: jobId },
        data: { status: "QUEUED", currentPrompt: rebuilt.prompt, promptVersionNumber: 1, attemptCount: attemptNumber, nextEligibleAt, leaseOwner: null, leaseExpiresAt: null, heartbeatAt: now, completedAt: null },
        select: { id: true, status: true, attemptCount: true, nextEligibleAt: true },
      });
      await tx.rnDTarget.update({ where: { id: job.targetId }, data: { status: "QUEUED" } });
      return { job: updatedJob, action: "REFINE" as const };
    }

    const updatedJob = await tx.rnDJob.update({
      where: { id: jobId },
      data: { status: "EXHAUSTED", attemptCount: attemptNumber, leaseOwner: null, leaseExpiresAt: null, heartbeatAt: now, completedAt: now },
      select: { id: true, status: true, attemptCount: true },
    });
    await tx.rnDTarget.update({ where: { id: job.targetId }, data: { status: "EXHAUSTED" } });
    return { job: updatedJob, action: "EXHAUSTED" as const };
  });

  return NextResponse.json({ ok: true, job: finalResult.job, action: finalResult.action, qa });
}
