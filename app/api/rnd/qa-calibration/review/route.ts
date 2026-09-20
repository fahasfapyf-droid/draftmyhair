import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") return null;
  return session;
}

function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

export async function GET(request: Request) {
  const session = await requireAdmin();
  if (!session) return json({ error: "Unauthorized" }, 401);

  const reviewerKey = new URL(request.url).searchParams.get("reviewerKey")?.trim() ?? "";
  if (!reviewerKey) return json({ error: "reviewerKey is required." }, 400);

  const attempt = await prisma.rnDAttempt.findFirst({
    where: {
      verdict: "HUMAN_APPROVAL",
      artifactId: { not: null },
      job: {
        target: {
          hardCoreInstruction: { not: null },
        },
      },
      calibrationRatings: {
        none: { reviewerKey },
      },
    },
    orderBy: { submittedAt: "asc" },
    select: {
      id: true,
      attemptNumber: true,
      artifactId: true,
      job: {
        select: {
          target: {
            select: {
              hardCoreInstruction: true,
            },
          },
        },
      },
    },
  });

  if (!attempt?.artifactId) return json({ available: false });

  return json({
    available: true,
    attemptId: attempt.id,
    imageUrl: `/api/rnd/qa-calibration/review/image?attemptId=${encodeURIComponent(attempt.id)}`,
    instruction: attempt.job.target.hardCoreInstruction,
  });
}

export async function POST(request: Request) {
  const session = await requireAdmin();
  if (!session) return json({ error: "Unauthorized" }, 401);

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const attemptId = typeof body?.attemptId === "string" ? body.attemptId.trim() : "";
  const reviewerKey = typeof body?.reviewerKey === "string" ? body.reviewerKey.trim() : "";
  const humanOverallScore = Number(body?.humanOverallScore);
  const humanHairstyleScore =
    body?.humanHairstyleScore == null ? null : Number(body.humanHairstyleScore);
  const notes = typeof body?.notes === "string" ? body.notes.trim() : null;

  if (!attemptId || !reviewerKey) {
    return json({ error: "attemptId and reviewerKey are required." }, 400);
  }
  if (!Number.isFinite(humanOverallScore) || humanOverallScore < 0 || humanOverallScore > 10) {
    return json({ error: "humanOverallScore must be between 0 and 10." }, 400);
  }
  if (
    humanHairstyleScore !== null &&
    (!Number.isFinite(humanHairstyleScore) || humanHairstyleScore < 0 || humanHairstyleScore > 10)
  ) {
    return json({ error: "humanHairstyleScore must be between 0 and 10." }, 400);
  }

  const attempt = await prisma.rnDAttempt.findUnique({
    where: { id: attemptId },
    select: {
      id: true,
      verdict: true,
      artifactId: true,
    },
  });

  if (!attempt || attempt.verdict !== "HUMAN_APPROVAL" || !attempt.artifactId) {
    return json({ error: "Review sample is not eligible." }, 404);
  }

  await prisma.rnDQAReferenceRating.upsert({
    where: { attemptId_reviewerKey: { attemptId, reviewerKey } },
    create: {
      attemptId,
      reviewerKey,
      humanOverallScore,
      humanHairstyleScore,
      notes: notes || null,
    },
    update: {
      humanOverallScore,
      humanHairstyleScore,
      notes: notes || null,
    },
  });

  // Never return AI score, QA verdict, or calibration status to the reviewer.
  return json({ ok: true }, 201);
}
