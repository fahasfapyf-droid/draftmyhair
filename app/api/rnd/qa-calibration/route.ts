import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireRndWorker } from "@/lib/rnd/worker-auth";
import {
  buildCalibrationSamples,
  summarizeCalibration,
  type CalibrationRating,
} from "@/lib/rnd/qa-calibration";

export const runtime = "nodejs";

function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

function policy() {
  return {
    minSamples: Number(process.env.RND_QA_CALIBRATION_MIN_SAMPLES ?? 20),
    maxFalsePassRate: Number(process.env.RND_QA_CALIBRATION_MAX_FALSE_PASS_RATE ?? 0.02),
    minCorrelation: Number(process.env.RND_QA_CALIBRATION_MIN_CORRELATION ?? 0.75),
  };
}

export async function POST(request: Request) {
  const unauthorized = requireRndWorker(request.headers.get("authorization"));
  if (unauthorized) return unauthorized;

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const attemptId = typeof body?.attemptId === "string" ? body.attemptId.trim() : "";
  const reviewerKey = typeof body?.reviewerKey === "string" ? body.reviewerKey.trim() : "";
  const humanOverallScore = Number(body?.humanOverallScore);
  const humanHairstyleScore =
    body?.humanHairstyleScore == null ? null : Number(body.humanHairstyleScore);
  const notes = typeof body?.notes === "string" ? body.notes.trim() : null;

  if (!attemptId || !reviewerKey) return json({ error: "attemptId and reviewerKey are required." }, 400);
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
    select: { id: true },
  });
  if (!attempt) return json({ error: "R&D attempt not found." }, 404);

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

  // Deliberately do not return AI scores or calibration status to the reviewer.
  return json({ ok: true }, 201);
}

export async function GET(request: Request) {
  const unauthorized = requireRndWorker(request.headers.get("authorization"));
  if (unauthorized) return unauthorized;

  const ratings = await prisma.rnDQAReferenceRating.findMany({
    select: {
      attemptId: true,
      reviewerKey: true,
      humanOverallScore: true,
      humanHairstyleScore: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const attemptIds = [...new Set(ratings.map((r) => r.attemptId))];
  const attempts = attemptIds.length
    ? await prisma.rnDAttempt.findMany({
        where: { id: { in: attemptIds } },
        select: { id: true, overallScore: true },
      })
    : [];

  const aiScores = new Map(
    attempts
      .filter((a) => a.overallScore != null)
      .map((a) => [a.id, Number(a.overallScore)]),
  );

  const normalized: CalibrationRating[] = ratings.map((r) => ({
    attemptId: r.attemptId,
    reviewerKey: r.reviewerKey,
    humanOverallScore: Number(r.humanOverallScore),
    humanHairstyleScore:
      r.humanHairstyleScore == null ? null : Number(r.humanHairstyleScore),
  }));

  const samples = buildCalibrationSamples(normalized, aiScores, 3);
  const summary = summarizeCalibration(samples, policy());

  return json({
    ...summary,
    samples: samples.map((sample) => ({
      attemptId: sample.attemptId,
      reviewerCount: sample.reviewerCount,
      humanOverallScore: sample.humanOverallScore,
      humanHairstyleScore: sample.humanHairstyleScore,
      aiOverallScore: sample.aiOverallScore,
    })),
  });
}
