import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRndWorker } from "@/lib/rnd/worker-auth";
import { isRndJobAtAttemptLimit, MAX_RND_ATTEMPTS } from "@/lib/rnd/attempt-limit";

export const runtime = "nodejs";

const RETRY_DELAY_MS = 60_000;

export async function POST(request: Request) {
  const authResponse = requireRndWorker(request.headers.get("authorization"));
  if (authResponse) return authResponse;

  const body = (await request.json().catch(() => null)) as { jobId?: unknown } | null;
  const jobId = typeof body?.jobId === "string" ? body.jobId.trim() : "";
  if (!jobId) {
    return NextResponse.json({ ok: false, error: "jobId is required" }, { status: 400 });
  }

  const now = new Date();
  const retryAt = new Date(now.getTime() + RETRY_DELAY_MS);

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Serialize with claim/requeue operations so two callers cannot requeue the same job.
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('draftmyhair-rnd-generation'))`;

      const job = await tx.rnDJob.findUnique({
        where: { id: jobId },
        select: {
          id: true,
          status: true,
          attemptCount: true,
          targetId: true,
          failureCode: true,
          target: { select: { status: true } },
        },
      });
      if (!job) return { kind: "not_found" as const };
      if (job.status !== "FAILED") {
        return { kind: "not_requeued" as const, status: job.status };
      }

      // Never reopen an exhausted job or exceed the hard attempt ceiling.
      if (isRndJobAtAttemptLimit(job.attemptCount)) {
        await tx.rnDJob.updateMany({
          where: { id: job.id, status: "FAILED", attemptCount: { gte: MAX_RND_ATTEMPTS } },
          data: {
            status: "EXHAUSTED",
            leaseOwner: null,
            leaseExpiresAt: null,
            heartbeatAt: now,
            completedAt: now,
            failureCode: "RND_CONVERGENCE_LIMIT",
            failureMessage: `R&D stopped after ${MAX_RND_ATTEMPTS} attempts without satisfying every hard-pass gate.`,
          },
        });
        await tx.rnDTarget.updateMany({
          where: { id: job.targetId, status: { notIn: ["APPROVED", "REJECTED"] } },
          data: { status: "EXHAUSTED" },
        });
        return { kind: "exhausted" as const, attemptCount: job.attemptCount };
      }

      // Human-review and terminal states must never be overwritten by a retry.
      if (["APPROVED", "REJECTED", "EXHAUSTED", "HUMAN_APPROVAL", "QA"].includes(job.target.status)) {
        return { kind: "target_locked" as const, targetStatus: job.target.status };
      }

      const updated = await tx.rnDJob.updateMany({
        where: { id: job.id, status: "FAILED", attemptCount: { lt: MAX_RND_ATTEMPTS } },
        data: {
          status: "QUEUED",
          queuedAt: now,
          nextEligibleAt: retryAt,
          leaseOwner: null,
          leaseExpiresAt: null,
          heartbeatAt: null,
          startedAt: null,
          completedAt: null,
          failureCode: null,
          failureMessage: null,
        },
      });
      if (updated.count !== 1) return { kind: "not_requeued" as const, status: "CHANGED_CONCURRENTLY" };

      await tx.rnDTarget.update({ where: { id: job.targetId }, data: { status: "QUEUED" } });
      return {
        kind: "requeued" as const,
        job: { id: job.id, status: "QUEUED", attemptCount: job.attemptCount, nextEligibleAt: retryAt },
      };
    });

    if (result.kind === "not_found") {
      return NextResponse.json({ ok: false, error: "Job not found" }, { status: 404 });
    }
    if (result.kind === "exhausted") {
      return NextResponse.json({ ok: false, error: "Attempt limit reached; job marked EXHAUSTED", attemptCount: result.attemptCount }, { status: 409 });
    }
    if (result.kind === "target_locked") {
      return NextResponse.json({ ok: false, error: "Target is in a protected workflow state", targetStatus: result.targetStatus }, { status: 409 });
    }
    if (result.kind === "not_requeued") {
      return NextResponse.json({ ok: true, requeued: false, status: result.status });
    }

    return NextResponse.json({ ok: true, requeued: true, job: result.job });
  } catch {
    return NextResponse.json({ ok: false, error: "Unable to requeue job" }, { status: 500 });
  }
}
