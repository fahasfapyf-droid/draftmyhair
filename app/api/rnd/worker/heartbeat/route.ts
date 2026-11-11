import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRndWorker, RND_WORKER_LEASE_SECONDS } from "@/lib/rnd/worker-auth";
import { parseRndClaimGeneration } from "@/lib/rnd/report-lease-fence";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const authResponse = requireRndWorker(request.headers.get("authorization"));
  if (authResponse) return authResponse;

  const body = await request.json().catch(() => null);
  const jobId = typeof body?.jobId === "string" ? body.jobId : null;
  const claimGeneration = parseRndClaimGeneration(body?.claimGeneration);
  const workerId = request.headers.get("x-rnd-worker-id")?.trim() || null;
  if (!jobId || !workerId || !claimGeneration) return NextResponse.json({ error: "jobId, x-rnd-worker-id and a valid claimGeneration are required" }, { status: 400 });

  const now = new Date();
  const leaseExpiresAt = new Date(now.getTime() + RND_WORKER_LEASE_SECONDS * 1000);
  const updated = await prisma.rnDJob.updateMany({
    where: { id: jobId, status: "PROCESSING", leaseOwner: workerId, startedAt: claimGeneration, leaseExpiresAt: { gt: now } },
    data: { heartbeatAt: now, leaseExpiresAt },
  });
  if (updated.count !== 1) return NextResponse.json({ error: "Job lease is no longer valid" }, { status: 409 });
  return NextResponse.json({ ok: true, leaseExpiresAt: leaseExpiresAt.toISOString() });
}
