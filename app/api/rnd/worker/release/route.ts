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

  const result = await prisma.$transaction(async (tx) => {
    const exists = await tx.rnDJob.findUnique({ where: { id: jobId }, select: { id: true } });
    if (!exists) return { kind: "missing" as const };
    const released = await tx.$queryRaw<Array<{ id: string; targetId: string }>>`
      UPDATE "RnDJob" AS job
      SET "status" = 'QUEUED', "leaseOwner" = NULL, "leaseExpiresAt" = NULL, "heartbeatAt" = NULL
      WHERE job."id" = ${jobId}
        AND job."status" = 'PROCESSING'
        AND job."leaseOwner" = ${workerId}
        AND job."startedAt" = ${claimGeneration}
        AND job."leaseExpiresAt" > clock_timestamp()
      RETURNING job."id", job."targetId"
    `;
    const job = released[0];
    if (released.length !== 1 || !job) return { kind: "lease" as const };
    await tx.rnDTarget.update({ where: { id: job.targetId }, data: { status: "QUEUED", currentJobId: job.id } });
    return { kind: "ok" as const };
  });

  if (result.kind === "missing") return NextResponse.json({ error: "Job not found" }, { status: 404 });
  if (result.kind === "lease") return NextResponse.json({ error: "Job lease is no longer valid" }, { status: 409 });
  return NextResponse.json({ ok: true });
}
