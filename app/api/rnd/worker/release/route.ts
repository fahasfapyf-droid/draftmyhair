import { configuredGenerationBudget, infrastructureBackoff, MAX_INFRASTRUCTURE_RETRIES } from "@/lib/rnd/retry-policy";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRndWorker } from "@/lib/rnd/worker-auth";
import { parseRndClaimGeneration } from "@/lib/rnd/report-lease-fence";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const authResponse = requireRndWorker(request.headers.get("authorization"));
  if (authResponse) return authResponse;

  const body = await request.json().catch(() => null);
  const jobId = typeof body?.jobId === "string" ? body.jobId : null;
  const claimGeneration = parseRndClaimGeneration(body?.claimGeneration);
  const workerId = request.headers.get("x-rnd-worker-id")?.trim() || null;
  if (!jobId || !workerId || !claimGeneration) {
    return NextResponse.json({ error: "jobId, x-rnd-worker-id and a valid claimGeneration are required" }, { status: 400 });
  }

  const globalBudget = configuredGenerationBudget();
  const result = await prisma.$transaction(async (tx) => {
    const exists = await tx.rnDJob.findUnique({ where: { id: jobId }, select: { id: true } });
    if (!exists) return { kind: "missing" as const };
    const released = await tx.$queryRaw<Array<{ id: string; targetId: string; status: "QUEUED" | "FAILED"; infrastructureRetryCount: number }>>`
      UPDATE "RnDJob" AS job
      SET "status" = CASE WHEN job."infrastructureRetryCount" >= ${MAX_INFRASTRUCTURE_RETRIES} OR job."attemptCount" >= LEAST(job."maxGenerationAttempts", ${globalBudget}) THEN 'FAILED'::"RnDJobStatus" ELSE 'QUEUED'::"RnDJobStatus" END,
          "infrastructureRetryCount" = job."infrastructureRetryCount" + 1,
          "failureCode" = CASE WHEN job."attemptCount" >= LEAST(job."maxGenerationAttempts", ${globalBudget}) THEN 'RND_CONVERGENCE_LIMIT' WHEN job."infrastructureRetryCount" >= ${MAX_INFRASTRUCTURE_RETRIES} THEN 'RND_INFRASTRUCTURE_RETRY_LIMIT' ELSE NULL END,
          "failureMessage" = CASE WHEN job."attemptCount" >= LEAST(job."maxGenerationAttempts", ${globalBudget}) THEN 'R&D generation budget exhausted.' WHEN job."infrastructureRetryCount" >= ${MAX_INFRASTRUCTURE_RETRIES} THEN 'Unsubmitted claim release budget exhausted.' ELSE NULL END,
          "completedAt" = CASE WHEN job."infrastructureRetryCount" >= ${MAX_INFRASTRUCTURE_RETRIES} OR job."attemptCount" >= LEAST(job."maxGenerationAttempts", ${globalBudget}) THEN (clock_timestamp() AT TIME ZONE 'UTC') ELSE NULL END,
          "leaseOwner" = NULL, "leaseExpiresAt" = NULL, "heartbeatAt" = NULL, "nextEligibleAt" = NULL
      WHERE job."id" = ${jobId}
        AND job."status" = 'PROCESSING'
        AND job."leaseOwner" = ${workerId}
        AND job."startedAt" = (${claimGeneration}::timestamptz AT TIME ZONE 'UTC')
        AND job."leaseExpiresAt" > (clock_timestamp() AT TIME ZONE 'UTC')
        AND NOT EXISTS (SELECT 1 FROM "RnDAttempt" AS attempt WHERE attempt."jobId" = job."id" AND attempt."attemptNumber" = job."attemptCount" + 1 AND
          (attempt."generationStartedAt" IS NOT NULL OR attempt."submittedAt" IS NOT NULL OR attempt."artifactId" IS NOT NULL))
      RETURNING job."id", job."targetId", job."status", job."infrastructureRetryCount"
    `;
    const job = released[0];
    if (released.length !== 1 || !job) return { kind: "lease" as const };
    if (job.status === "QUEUED") await tx.rnDJob.update({ where: { id: job.id }, data: { nextEligibleAt: new Date(Date.now() + infrastructureBackoff(job.infrastructureRetryCount)) } });
    await tx.rnDTarget.update({ where: { id: job.targetId }, data: { status: job.status, currentJobId: job.id } });
    return { kind: "ok" as const };
  });

  if (result.kind === "missing") return NextResponse.json({ error: "Job not found" }, { status: 404 });
  if (result.kind === "lease") return NextResponse.json({ error: "Job lease is no longer valid" }, { status: 409 });
  return NextResponse.json({ ok: true });
}
