import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRndWorker } from "@/lib/rnd/worker-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    requireRndWorker(request.headers.get("authorization"));
  } catch (response) {
    return response;
  }

  const body = await request.json().catch(() => null);
  const jobId = typeof body?.jobId === "string" ? body.jobId : null;
  const workerId = request.headers.get("x-rnd-worker-id")?.trim() || null;

  if (!jobId || !workerId) {
    return NextResponse.json({ error: "jobId and x-rnd-worker-id are required" }, { status: 400 });
  }

  const result = await prisma.$transaction(async (tx) => {
    const job = await tx.rnDJob.findUnique({ where: { id: jobId }, select: { id: true, targetId: true, status: true, leaseOwner: true } });
    if (!job) return { kind: "missing" as const };
    if (job.status !== "PROCESSING" || job.leaseOwner !== workerId) return { kind: "lease" as const };

    const updated = await tx.rnDJob.updateMany({
      where: { id: jobId, status: "PROCESSING", leaseOwner: workerId },
      data: {
        status: "QUEUED",
        leaseOwner: null,
        leaseExpiresAt: null,
        heartbeatAt: null,
      },
    });

    if (updated.count !== 1) return { kind: "lease" as const };

    await tx.rnDTarget.update({
      where: { id: job.targetId },
      data: { status: "QUEUED", currentJobId: job.id },
    });

    return { kind: "ok" as const };
  });

  if (result.kind === "missing") return NextResponse.json({ error: "Job not found" }, { status: 404 });
  if (result.kind === "lease") return NextResponse.json({ error: "Job lease is no longer valid" }, { status: 409 });
  return NextResponse.json({ ok: true });
}
