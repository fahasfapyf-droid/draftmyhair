import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { lockActiveAdmin } from "@/lib/rnd/admin-auth";
import { lockCalibration } from "@/lib/rnd/calibration-evidence";

export const runtime = "nodejs";
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });
const hash = (text: string) => createHash("sha256").update(text).digest("hex");

export async function GET(_request: Request) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") return json({ code: "UNAUTHORIZED" }, 401);
  const reviewer = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true, isActive: true, isDeleted: true } });
  if (!reviewer || reviewer.role !== "ADMIN" || !reviewer.isActive || reviewer.isDeleted) return json({ code: "UNAUTHORIZED" }, 401);
  const attempt = await prisma.rnDAttempt.findFirst({
    where: { artifactId: { not: null }, generationCompletedAt: { not: null }, overallScore: { not: null }, calibrationRatings: { none: { reviewedByUserId: session.user.id } } },
    orderBy: { submittedAt: "asc" }, select: { id: true, job: { select: { target: { select: { hardCoreInstruction: true } } } } },
  });
  return attempt ? json({ available: true, attemptId: attempt.id, imageUrl: `/api/rnd/qa-calibration/review/image?attemptId=${encodeURIComponent(attempt.id)}`, instruction: attempt.job.target.hardCoreInstruction }) : json({ available: false });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") return json({ code: "UNAUTHORIZED" }, 401);
  const body = await request.json().catch(() => null);
  const overall = body?.humanOverallScore, style = body?.humanHairstyleScore ?? null;
  if (typeof body?.attemptId !== "string" || typeof body?.receiptToken !== "string" || body.receiptToken.length < 32 || body.receiptToken.length > 128 ||
      typeof overall !== "number" || !Number.isFinite(overall) || overall < 0 || overall > 10 ||
      (style !== null && (typeof style !== "number" || !Number.isFinite(style) || style < 0 || style > 10))) return json({ code: "RND_CALIBRATION_INVALID_REVIEW" }, 400);

  try {
    const outcome = await prisma.$transaction(async tx => {
      await lockCalibration(tx);
      if (!await lockActiveAdmin(tx, session.user.id)) return "UNAUTHORIZED";
      const attempt = await tx.rnDAttempt.findUnique({ where: { id: body.attemptId }, include: { artifact: true } });
      const artifactChecksum = attempt?.artifact?.checksum;
      if (!attempt?.artifact || !attempt.generationCompletedAt || attempt.overallScore === null || attempt.artifact.kind !== "GENERATED" ||
          typeof artifactChecksum !== "string" || !/^[a-f0-9]{64}$/.test(artifactChecksum) || !attempt.artifact.storageKey.startsWith(`rnd/attempts/${attempt.jobId}/${attempt.attemptNumber}-`)) return "RND_CALIBRATION_SAMPLE_INELIGIBLE";

      const consumed = await tx.rnDQAReviewReceipt.updateMany({
        where: { tokenHash: hash(body.receiptToken), attemptId: attempt.id, reviewerId: session.user.id,
          promptChecksum: hash(attempt.prompt), artifactChecksum, expiresAt: { gt: new Date() }, consumedAt: null },
        data: { consumedAt: new Date() },
      });
      if (consumed.count !== 1) return "RND_CALIBRATION_REVIEW_RECEIPT_INVALID";

      await tx.rnDQAReferenceRating.create({ data: {
        attemptId: attempt.id, reviewerKey: `admin:${session.user.id}`, humanOverallScore: overall,
        humanHairstyleScore: style, notes: typeof body.notes === "string" ? body.notes.trim().slice(0, 2000) : null,
        reviewedByUserId: session.user.id, reviewedAt: new Date(), promptChecksum: hash(attempt.prompt), artifactChecksum,
      } });
      return "OK";
    });
    return outcome === "OK" ? json({ ok: true }, 201) : json({ code: outcome }, outcome === "UNAUTHORIZED" ? 401 : 409);
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") return json({ code: "RND_CALIBRATION_REVIEW_ALREADY_SUBMITTED" }, 409);
    throw error;
  }
}
