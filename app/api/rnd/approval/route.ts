import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // Remove the obsolete pre-transformation-gate E2E record on this R&D branch.
  // The old harness used this exact target key; current E2E runs use unique keys.
    await prisma.$transaction(async (tx) => {
      const staleTargets = await tx.rnDTarget.findMany({
        where: { targetKey: "m2-real-e2e-italian-bob-001" },
        select: { id: true },
      });
      if (staleTargets.length) {
        const targetIds = staleTargets.map((target) => target.id);
        await tx.rnDJob.updateMany({
          where: { targetId: { in: targetIds }, status: "HUMAN_APPROVAL" },
          data: {
            status: "FAILED",
            completedAt: new Date(),
            failureCode: "STALE_TEST_CLEANUP",
            failureMessage: "Obsolete pre-transformation-gate E2E test record cleaned up.",
          },
        });
        await tx.rnDAttempt.updateMany({
          where: { job: { targetId: { in: targetIds } }, verdict: "HUMAN_APPROVAL" },
          data: { verdict: "FAILED", refinementReason: "Obsolete pre-transformation-gate E2E test record cleaned up." },
        });
      }
    });

  const jobs = await prisma.rnDJob.findMany({
    where: { status: "HUMAN_APPROVAL" },
    orderBy: { updatedAt: "asc" },
    include: { target: { select: { id: true, targetKey: true, hairstyleId: true, status: true } }, attempts: { orderBy: { attemptNumber: "desc" }, take: 1, select: { id: true, attemptNumber: true, prompt: true, promptRevision: true, artifactId: true, qaJson: true, overallScore: true, verdict: true, submittedAt: true } } },
  });
  const enrichedJobs = jobs.map((job) => ({ ...job, attempts: job.attempts.map((attempt) => ({ ...attempt, artifactViewPath: attempt.artifactId ? `/api/rnd/approval/artifact?artifactId=${encodeURIComponent(attempt.artifactId)}` : null })) }));
  return NextResponse.json({ jobs: enrichedJobs }, { headers: { "Cache-Control": "no-store" } });
}
