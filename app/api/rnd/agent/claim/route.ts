import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireRndWorker, RND_WORKER_LEASE_SECONDS } from "@/lib/rnd/worker-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const authResponse = requireRndWorker(request.headers.get("authorization"));
  if (authResponse) return authResponse;

  const workerId = request.headers.get("x-rnd-worker-id")?.trim() || "";
  if (!workerId) return NextResponse.json({ error: "x-rnd-worker-id is required" }, { status: 400 });

  const now = new Date();
  const leaseExpiresAt = new Date(now.getTime() + RND_WORKER_LEASE_SECONDS * 1000);

  // Claim a single ready job. QUEUED is the durable hand-off state between
  // the Vercel control plane and the browser agent.
  const candidates = await prisma.rnDJob.findMany({
    where: {
      status: "QUEUED",
      OR: [{ nextEligibleAt: null }, { nextEligibleAt: { lte: now } }],
    },
    orderBy: [{ queuedAt: "asc" }, { id: "asc" }],
    take: 20,
    select: { id: true },
  });

  for (const candidate of candidates) {
    const claimed = await prisma.$transaction(async (tx) => {
      const result = await tx.rnDJob.updateMany({
        where: {
          id: candidate.id,
          status: "QUEUED",
          OR: [{ nextEligibleAt: null }, { nextEligibleAt: { lte: now } }],
        },
        data: {
          status: "PROCESSING",
          leaseOwner: workerId,
          leaseExpiresAt,
          heartbeatAt: now,
          startedAt: now,
          nextEligibleAt: null,
        },
      });

      if (result.count !== 1) return null;

      const job = await tx.rnDJob.findUnique({
        where: { id: candidate.id },
        select: {
          id: true,
          targetId: true,
          attemptCount: true,
          currentPrompt: true,
          target: {
            select: {
              hairstyleId: true,
              hardCoreInstruction: true,
              sourceAsset: {
                select: { id: true, blobUrl: true, mimeType: true, fileSize: true, originalFilename: true },
              },
            },
          },
        },
      });
      if (!job) throw new Error("Claimed R&D job disappeared.");

      const attemptNumber = job.attemptCount + 1;
      await tx.rnDAttempt.create({
        data: {
          jobId: job.id,
          attemptNumber,
          prompt: job.currentPrompt,
          promptRevision: "RESERVED",
          submittedAt: now,
          verdict: "REFINE",
        },
      });
      await tx.rnDTarget.update({
        where: { id: job.targetId },
        data: { status: "PROCESSING", currentJobId: job.id },
      });

      return { ...job, attemptNumber };
    });

    if (claimed) {
      return NextResponse.json({
        ok: true,
        job: {
          id: claimed.id,
          targetId: claimed.targetId,
          attemptNumber: claimed.attemptNumber,
          prompt: claimed.currentPrompt,
          source: claimed.target.sourceAsset,
          hairstyleId: claimed.target.hairstyleId,
          hardCoreInstruction: claimed.target.hardCoreInstruction,
          leaseExpiresAt,
        },
      });
    }
  }

  return NextResponse.json({ ok: true, job: null, message: "No R&D jobs are ready for the browser agent." });
}
