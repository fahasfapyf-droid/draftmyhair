import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { reconcileRndCampaignLifecycle } from "@/lib/rnd/campaign-lifecycle";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  const jobId = typeof body?.jobId === "string" ? body.jobId : null;
  const reason = typeof body?.reason === "string" ? body.reason.trim().slice(0, 2000) : "";
  if (!jobId) return NextResponse.json({ error: "jobId is required" }, { status: 400 });

  const result = await prisma.$transaction(async (tx) => {
    const job = await tx.rnDJob.findUnique({
      where: { id: jobId },
      select: { id: true, targetId: true, status: true, target: { select: { campaignId: true } } },
    });
    if (!job) return { kind: "missing" as const };
    if (job.status !== "HUMAN_APPROVAL") return { kind: "state" as const, status: job.status };

    const failureMessage = reason || "Rejected during human approval.";
    await tx.rnDJob.update({
      where: { id: jobId },
      data: { status: "FAILED", completedAt: new Date(), failureCode: "HUMAN_REJECTED", failureMessage },
    });
    await tx.rnDTarget.update({ where: { id: job.targetId }, data: { status: "REJECTED" } });
    await tx.rnDAttempt.updateMany({
      where: { jobId, verdict: "HUMAN_APPROVAL" },
      data: { verdict: "FAILED", refinementReason: failureMessage },
    });

    const campaignStatus = await reconcileRndCampaignLifecycle(tx, job.target.campaignId);
    return { kind: "ok" as const, campaignStatus };
  });

  if (result.kind === "missing") return NextResponse.json({ error: "Job not found" }, { status: 404 });
  if (result.kind === "state") return NextResponse.json({ error: "Job is not awaiting human approval", status: result.status }, { status: 409 });
  return NextResponse.json({ ok: true, campaignStatus: result.campaignStatus });
}
