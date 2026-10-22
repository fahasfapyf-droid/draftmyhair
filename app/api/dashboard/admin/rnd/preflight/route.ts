import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_RND_ATTEMPTS = 5;
const ONLINE_WINDOW_MS = 90_000;

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") return null;
  return session;
}

/** Read-only preflight. Unknown/error conditions must never imply permission to launch. */
export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [jobGroups, queuedJobs, processingJobs, overLimitJobs, workers] =
    await Promise.all([
      prisma.rnDJob.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.rnDJob.findMany({
        where: { status: "QUEUED" },
        orderBy: { queuedAt: "asc" },
        select: { id: true, status: true, attemptCount: true, queuedAt: true, nextEligibleAt: true, targetId: true, leaseOwner: true, leaseExpiresAt: true },
      }),
      prisma.rnDJob.findMany({
        where: { status: "PROCESSING" },
        orderBy: { queuedAt: "asc" },
        select: { id: true, status: true, attemptCount: true, queuedAt: true, heartbeatAt: true, targetId: true, leaseOwner: true, leaseExpiresAt: true },
      }),
      prisma.rnDJob.findMany({
        where: { attemptCount: { gte: MAX_RND_ATTEMPTS }, status: { in: ["QUEUED", "PROCESSING"] } },
        select: { id: true, status: true, attemptCount: true, targetId: true, failureCode: true },
      }),
      prisma.rnDWorkerStatus.findMany({
        orderBy: { lastHeartbeatAt: "desc" },
        select: { workerId: true, workerState: true, currentJobId: true, lastHeartbeatAt: true, captureStatus: true },
      }),
    ]);
  const now = Date.now();
  const workerSummary = workers.map((worker) => ({
    workerId: worker.workerId,
    lastHeartbeatAt: worker.lastHeartbeatAt.toISOString(),
    online: now - worker.lastHeartbeatAt.getTime() <= ONLINE_WINDOW_MS,
  }));
  const onlineWorkers = workerSummary.filter((worker) => worker.online);
  const jobCounts = Object.fromEntries(
    jobGroups.map((group) => [group.status, group._count._all]),
  ) as Record<string, number>;
  const blockers: string[] = [];
  if (queuedJobs.length > 0) blockers.push("QUEUED_JOBS_PRESENT");
  if (processingJobs.length > 0) blockers.push("PROCESSING_JOBS_PRESENT");
  if (overLimitJobs.length > 0) blockers.push("ACTIVE_JOBS_AT_ATTEMPT_CEILING");
  if (onlineWorkers.length > 0) blockers.push("WORKER_HEARTBEATS_PRESENT");

  return NextResponse.json({
    ok: true,
    verdict: blockers.length === 0 ? "SAFE" : "BLOCKED",
    generatedAt: new Date(now).toISOString(),
    policy: { maxAttemptsPerJob: MAX_RND_ATTEMPTS, onlineHeartbeatWindowMs: ONLINE_WINDOW_MS, readOnly: true },
    summary: {
      totalJobs: jobGroups.reduce((sum, group) => sum + group._count._all, 0),
      jobCounts,
      queuedJobCount: queuedJobs.length,
      processingJobCount: processingJobs.length,
      activeJobCount: queuedJobs.length + processingJobs.length,
      activeJobsAtAttemptCeilingCount: overLimitJobs.length,
      workerRecordCount: workers.length,
      onlineWorkerCount: onlineWorkers.length,
    },
    blockers, 
    queuedJobs,
    processingJobs,
    activeJobsAtAttemptCeiling: overLimitJobs,    workers: workerSummary,
  }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}