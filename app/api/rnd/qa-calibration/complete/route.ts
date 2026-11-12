import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { lockActiveAdmin } from "@/lib/rnd/admin-auth";
import { lockPromptStyle, verifiedHumanApproval } from "@/lib/rnd/promotion-provenance";
import { CALIBRATION_POLICY_VERSION, computeCalibration, lockCalibration } from "@/lib/rnd/calibration-evidence";

export const runtime = "nodejs";
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body || Object.keys(body).length !== 1 || typeof body.promptVersionId !== "string" || !body.promptVersionId.trim()) return NextResponse.json({ code: "RND_CALIBRATION_INVALID_REQUEST" }, { status: 400 });
  const found = await prisma.promptVersion.findUnique({ where: { id: body.promptVersionId }, select: { hairstyleId: true } });
  if (!found) return NextResponse.json({ code: "RND_CALIBRATION_CANDIDATE_MISSING" }, { status: 404 });
  const result = await prisma.$transaction(async tx => {
    if (!await lockPromptStyle(tx, found.hairstyleId)) return { code: "RND_CALIBRATION_CANDIDATE_MISSING" };
    await lockCalibration(tx);
    if (!await lockActiveAdmin(tx, session.user.id)) return { code: "UNAUTHORIZED" };
    const candidate = await tx.promptVersion.findUnique({ where: { id: body.promptVersionId }, include: { sourceRnDAttempt: { include: { artifact: true, job: { include: { target: true } } } } } });
    const source = candidate?.sourceRnDAttempt;
    if (!candidate || candidate.status !== "DRAFT" || !source || source.verdict !== "APPROVED" || source.job.status !== "COMPLETED" || source.job.target.status !== "APPROVED" ||
        source.job.target.hairstyleId !== candidate.hairstyleId || source.prompt !== candidate.prompt || !verifiedHumanApproval(source)) return { code: "RND_CALIBRATION_SOURCE_UNVERIFIED" };
    const computed = await computeCalibration(tx, candidate);
    const run = await tx.rnDPromptCalibration.create({ data: { promptVersionId: candidate.id, hairstyleId: candidate.hairstyleId, promptChecksum: computed.promptChecksum,
      sourceAttemptId: source.id, result: computed.result, completedAt: new Date(), executedByUserId: session.user.id, policyVersion: CALIBRATION_POLICY_VERSION,
      evidenceDigest: computed.evidenceDigest, summary: computed.summary } });
    await tx.promptVersion.update({ where: { id: candidate.id }, data: { qaStatus: computed.result === "PASSED" ? "PASSED" : "TESTING" } });
    return { code: "OK", calibrationId: run.id.toString(), result: computed.result };
  });
  return NextResponse.json(result, { status: result.code === "OK" ? 200 : result.code === "UNAUTHORIZED" ? 401 : 409 });
}
