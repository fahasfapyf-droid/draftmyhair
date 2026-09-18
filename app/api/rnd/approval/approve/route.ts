import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  const jobId = typeof body?.jobId === "string" ? body.jobId : null;
  if (!jobId) return NextResponse.json({ error: "jobId is required" }, { status: 400 });

  const result = await prisma.$transaction(async (tx) => {
    const job = await tx.rnDJob.findUnique({ where: { id: jobId }, select: { id: true, targetId: true, status: true } });
    if (!job) return { kind: "missing" as const };
    if (job.status !== "HUMAN_APPROVAL") return { kind: "state" as const, status: job.status };
    await tx.rnDJob.update({ where: { id: jobId }, data: { status: "COMPLETED", completedAt: new Date() } });
    await tx.rnDTarget.update({ where: { id: job.targetId }, data: { status: "APPROVED" } });
    await tx.rnDAttempt.updateMany({ where: { jobId, verdict: "HUMAN_APPROVAL" }, data: { verdict: "APPROVED" } });
    return { kind: "ok" as const };
  });

  if (result.kind === "missing") return NextResponse.json({ error: "Job not found" }, { status: 404 });
  if (result.kind === "state") return NextResponse.json({ error: "Job is not awaiting human approval", status: result.status }, { status: 409 });
  return NextResponse.json({ ok: true });
}
