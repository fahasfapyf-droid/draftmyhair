import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { lockActiveAdmin } from "@/lib/rnd/admin-auth";
import { lockPromptStyle, verifiedHumanApproval } from "@/lib/rnd/promotion-provenance";
import { hasVerifiedCalibration, lockCalibration } from "@/lib/rnd/calibration-evidence";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") return NextResponse.json({ code: "RND_PROMOTION_ADMIN_REQUIRED" }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (typeof body?.promptKey !== "string" || typeof body?.sourceAttemptId !== "string") return NextResponse.json({ code: "RND_PROMOTION_INVALID_REQUEST" }, { status: 400 });

  const result = await prisma.$transaction(async tx => {
    const style = await tx.hairstyle.findUnique({ where: { promptKey: body.promptKey }, select: { id: true } });
    if (!style || !await lockPromptStyle(tx, style.id)) return { code: "RND_PROMOTION_SOURCE_UNVERIFIED" };
    await lockCalibration(tx);
    // Lock order is style -> calibration -> actor across all privileged writes.
    // FOR SHARE prevents concurrent demotion/deactivation before commit.
    if (!await lockActiveAdmin(tx, session.user.id)) return { code: "RND_PROMOTION_ADMIN_REQUIRED" };

    const source = await tx.rnDAttempt.findUnique({ where: { id: body.sourceAttemptId }, include: {
      artifact: true, job: { include: { target: true } }, promptVersion: true,
    } });
    // One authoritative local chain; foreign isolated-DB IDs fail closed.
    // Caller flags and shared secrets cannot attest cross-environment review.
    if (!source || source.verdict !== "APPROVED" || source.job.status !== "COMPLETED" || source.job.target.status !== "APPROVED" ||
        source.job.target.hairstyleId !== style.id || !verifiedHumanApproval(source) ||
        (body.sourceJobId !== undefined && body.sourceJobId !== source.jobId) || (body.prompt !== undefined && body.prompt !== source.prompt)) return { code: "RND_PROMOTION_SOURCE_UNVERIFIED" };
    const candidate = source.promptVersion;
    if (!candidate || candidate.sourceRnDAttemptId !== source.id || candidate.hairstyleId !== style.id || candidate.prompt !== source.prompt || candidate.qaStatus !== "PASSED" ||
        !["DRAFT", "ACTIVE"].includes(candidate.status) || !await hasVerifiedCalibration(tx, candidate)) return { code: "RND_PROMOTION_CALIBRATION_REQUIRED" };
    if (candidate.status === "ACTIVE") return { code: "OK", promptVersionId: candidate.id, idempotent: true };
    await tx.promptVersion.updateMany({ where: { hairstyleId: style.id, status: "ACTIVE", id: { not: candidate.id } }, data: { status: "ARCHIVED" } });
    await tx.promptVersion.update({ where: { id: candidate.id }, data: { status: "ACTIVE" } });
    return { code: "OK", promptVersionId: candidate.id, idempotent: false };
  });
  const status = result.code === "OK" ? 200 : result.code === "RND_PROMOTION_ADMIN_REQUIRED" ? 401 : 409;
  return NextResponse.json(result, { status });
}
