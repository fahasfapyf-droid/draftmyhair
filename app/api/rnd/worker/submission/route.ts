import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRndWorker } from "@/lib/rnd/worker-auth";
import { fenceRndReportLease, parseRndClaimGeneration } from "@/lib/rnd/report-lease-fence";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const denied = requireRndWorker(request.headers.get("authorization"));
  if (denied) return denied;
  const workerId = request.headers.get("x-rnd-worker-id")?.trim();
  const body = await request.json().catch(() => null);
  const jobId = typeof body?.jobId === "string" ? body.jobId : null;
  const attemptNumber = body?.attemptNumber;
  const claimStartedAt = parseRndClaimGeneration(body?.claimGeneration);
  const phase = body?.phase;
  if (!workerId || !jobId || !Number.isInteger(attemptNumber) || attemptNumber < 1 || attemptNumber > 5 ||
      !claimStartedAt || (phase !== "begin" && phase !== "submitted")) {
    return NextResponse.json({ code: "RND_SUBMISSION_REQUEST_INVALID" }, { status: 400 });
  }
  const committed = await prisma.$transaction(async (tx) => {
    const attempt = await tx.rnDAttempt.findUnique({
      where: { jobId_attemptNumber: { jobId, attemptNumber } }, select: { id: true },
    });
    if (!attempt || !await fenceRndReportLease(tx, { jobId, workerId, claimStartedAt,
      expectedAttemptCount: attemptNumber - 1, attemptId: attempt.id, attemptNumber })) return false;

    const now = new Date();
    const changed = await tx.rnDAttempt.updateMany({
      where: { id: attempt.id, verdict: "REFINE", artifactId: null, promptRevision: "reserved-v2",
        ...(phase === "begin" ? { generationStartedAt: null } : { errorCode: "RND_SUBMISSION_UNCERTAIN" }) },
      data: phase === "begin" ? { generationStartedAt: now, errorCode: "RND_SUBMISSION_UNCERTAIN" } :
        { submittedAt: now, errorCode: "RND_SUBMITTED" },
    });
    return changed.count === 1;
  });
  if (!committed) return NextResponse.json({ code: "RND_SUBMISSION_FENCE_REJECTED" }, { status: 409 });
  return NextResponse.json({ ok: true, phase });
}
