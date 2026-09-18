import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const jobs = await prisma.rnDJob.findMany({
    where: { status: "HUMAN_APPROVAL" },
    orderBy: { updatedAt: "asc" },
    include: { target: { select: { id: true, targetKey: true, hairstyleId: true, status: true } }, attempts: { orderBy: { attemptNumber: "desc" }, take: 1, select: { id: true, attemptNumber: true, artifactId: true, qaJson: true, overallScore: true, verdict: true, submittedAt: true } } },
  });
  const enrichedJobs = jobs.map((job) => ({ ...job, attempts: job.attempts.map((attempt) => ({ ...attempt, artifactViewPath: attempt.artifactId ? `/api/rnd/approval/artifact?artifactId=${encodeURIComponent(attempt.artifactId)}` : null })) }));\n  return NextResponse.json({ jobs: enrichedJobs }, { headers: { "Cache-Control": "no-store" } });
}
