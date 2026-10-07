import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRndWorker, RND_WORKER_LEASE_SECONDS } from "@/lib/rnd/worker-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const authResponse = requireRndWorker(request.headers.get("authorization"));
  if (authResponse) return authResponse;

  const workerId = request.headers.get("x-rnd-worker-id")?.trim() || "";
  const body = (await request.json().catch(() => null)) as { jobId?: unknown } | null;
  const jobId = typeof body?.jobId === "string" ? body.jobId : "";
  if (!workerId || !jobId) return NextResponse.json({ error: "worker id and jobId are required" }, { status: 400 });

  const now = new Date();
  const leaseExpiresAt = new Date(now.getTime() + RND_WORKER_LEASE_SECONDS * 1000);
  const updated = await prisma.rnDJob.updateMany({
    where: { id: jobId, status: "PROCESSING", leaseOwner: workerId },
    data: { leaseExpiresAt, heartbeatAt: now },
  });

  if (updated.count !== 1) return NextResponse.json({ error: "Job lease is no longer valid" }, { status: 409 });
  return NextResponse.json({ ok: true, leaseExpiresAt });
}
