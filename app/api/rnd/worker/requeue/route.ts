import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRndWorker } from "@/lib/rnd/worker-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const authResponse = requireRndWorker(request.headers.get("authorization"));
  if (authResponse) return authResponse;

  const body = (await request.json().catch(() => null)) as { jobId?: unknown } | null;
  const jobId = typeof body?.jobId === "string" ? body.jobId.trim() : "";
  if (!jobId) return NextResponse.json({ error: "jobId is required" }, { status: 400 });

  const now = new Date();
  const retryAt = new Date(now.getTime() + 60_000);
  const result = await prisma.$transaction(async (tx) => {
    const job = await tx.rnDJob.findUnique({
      where: { id: jobId },
      select: { id: true, status: true, attemptCount: true, targetId: true, failureCode: true },
    });
    if (!job) return null;
    if (job.status !== "FAILED") return { job, requeued: false };
    const updated = await tx.rnDJob.update({
      where: { id: jobId },
      data: {
        status: "QUEUED",
        nextEligibleAt: retryAt,
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
    return { job: updated, requeued: true };
  });

  if (!result) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  return NextResponse.json({ ok: true, ...result });
}
