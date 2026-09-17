import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRndWorker } from "@/lib/rnd/worker-auth";

export const runtime = "nodejs";

const MAX_AUTONOMOUS_ATTEMPTS = 2;

type ReportBody = { jobId?: unknown; attemptNumber?: unknown; prompt?: unknown; promptRevision?: unknown; submittedAt?: unknown; generationStartedAt?: unknown; generationCompletedAt?: unknown; artifactId?: unknown; errorCode?: unknown; errorMessage?: unknown };

function dateOrNull(value: unknown) {
  if (typeof value !== "string") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function POST(request: Request) {
  const authResponse = requireRndWorker(request.headers.get("authorization"));
  if (authResponse) return authResponse;

  const body = (await request.json().catch(() => null)) as ReportBody | null;
  const jobId = typeof body?.jobId === "string" ? body.jobId : null;
  const attemptNumber = Number.isInteger(body?.attemptNumber) ? Number(body.attemptNumber) : null;
  const prompt = typeof body?.prompt === "string" ? body.prompt : null;
  const promptRevision = typeof body?.promptRevision === "string" ? body.promptRevision : null;
  const workerId = request.headers.get("x-rnd-worker-id")?.trim() || null;
  if (!jobId || !attemptNumber || attemptNumber < 1 || !prompt || !promptRevision || !workerId) return NextResponse.json({ error: "jobId, attemptNumber, prompt, promptRevision and x-rnd-worker-id are required" }, { status: 400 });
  if (attemptNumber > MAX_AUTONOMOUS_ATTEMPTS) return NextResponse.json({ error: "Maximum autonomous attempts exceeded" }, { status: 409 });

  const generationStartedAt = dateOrNull(body?.generationStartedAt);
  const generationCompletedAt = dateOrNull(body?.generationCompletedAt);
  const submittedAt = dateOrNull(body?.submittedAt) ?? new Date();
  const artifactId = typeof body?.artifactId === "string" ? body.artifactId : null;
  const errorCode = typeof body?.errorCode === "string" ? body.errorCode : null;
  const errorMessage = typeof body?.errorMessage === "string" ? body.errorMessage : null;
  const succeeded = !errorCode && !errorMessage && Boolean(generationCompletedAt) && Boolean(artifactId);
  const now = new Date();

  const result = await prisma.$transaction(async (tx) => {
    const job = await tx.rnDJob.findUnique({ where: { id: jobId }, select: { id: true, targetId: true, attemptCount: true, status: true, leaseOwner: true, leaseExpiresAt: true } });
    if (!job) return { kind: "missing" as const };
    if (job.leaseOwner !== workerId || (job.leaseExpiresAt && job.leaseExpiresAt < now) || job.status !== "PROCESSING") return { kind: "lease" as const };
    if (attemptNumber !== job.attemptCount + 1) return { kind: "attempt" as const, expected: job.attemptCount + 1 };

    await tx.rnDAttempt.create({ data: { jobId, attemptNumber, prompt, promptRevision, submittedAt, generationStartedAt, generationCompletedAt, artifactId, verdict: succeeded ? "REFINE" : "FAILED", errorCode, errorMessage } });
    const updatedJob = await tx.rnDJob.update({ where: { id: jobId }, data: { status: succeeded ? "QA" : "FAILED", attemptCount: attemptNumber, leaseOwner: null, leaseExpiresAt: null, heartbeatAt: now, completedAt: succeeded ? generationCompletedAt : null, failureCode: succeeded ? null : errorCode, failureMessage: succeeded ? null : errorMessage }, select: { id: true, status: true, attemptCount: true } });
    await tx.rnDTarget.update({ where: { id: job.targetId }, data: { status: succeeded ? "QA" : "FAILED" } });
    return { kind: "ok" as const, job: updatedJob };
  });

  if (result.kind === "missing") return NextResponse.json({ error: "Job not found" }, { status: 404 });
  if (result.kind === "lease") return NextResponse.json({ error: "Job lease is no longer valid" }, { status: 409 });
  if (result.kind === "attempt") return NextResponse.json({ error: "Unexpected attempt number", expectedAttemptNumber: result.expected }, { status: 409 });
  return NextResponse.json({ ok: true, job: result.job });
}
