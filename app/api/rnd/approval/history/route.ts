import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const attempts = await prisma.rnDAttempt.findMany({
    where: { verdict: "APPROVED" },
    orderBy: { generationCompletedAt: "desc" },
    select: {
      id: true,
      attemptNumber: true,
      prompt: true,
      promptRevision: true,
      overallScore: true,
      verdict: true,
      submittedAt: true,
      generationStartedAt: true,
      generationCompletedAt: true,
      artifactId: true,
      qaJson: true,
      job: {
        select: {
          id: true,
          completedAt: true,
          target: {
            select: {
              id: true,
              targetKey: true,
              hairstyleId: true,
            },
          },
        },
      },
    },
  });

  const history = attempts.map((attempt) => {
    const qa = attempt.qaJson && typeof attempt.qaJson === "object"
      ? attempt.qaJson as Record<string, unknown>
      : null;

    return {
      id: attempt.id,
      jobId: attempt.job.id,
      attemptNumber: attempt.attemptNumber,
      prompt: attempt.prompt,
      promptRevision: attempt.promptRevision,
      overallScore: attempt.overallScore,
      submittedAt: attempt.submittedAt,
      generationStartedAt: attempt.generationStartedAt,
      generationCompletedAt: attempt.generationCompletedAt,
      approvalCompletedAt: attempt.job.completedAt,
      artifactId: attempt.artifactId,
      artifactViewPath: attempt.artifactId
        ? `/api/rnd/approval/artifact?artifactId=${encodeURIComponent(attempt.artifactId)}`
        : null,
      qaReason: typeof qa?.reason === "string" ? qa.reason : "",
      target: attempt.job.target,
    };
  });

  return NextResponse.json(
    { history },
    { headers: { "Cache-Control": "no-store" } },
  );
}
