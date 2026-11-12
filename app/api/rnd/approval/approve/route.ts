import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { eligibleRndApproval, humanApprovalProof, lockPromptStyle } from "@/lib/rnd/promotion-provenance";
import { lockActiveAdmin } from "@/lib/rnd/admin-auth";
import { lockCalibration } from "@/lib/rnd/calibration-evidence";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const jobId = typeof body?.jobId === "string" ? body.jobId : null;
  if (!jobId) return NextResponse.json({ error: "jobId is required" }, { status: 400 });

  const result = await prisma.$transaction(async (tx) => {
    const job = await tx.rnDJob.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        targetId: true,
        status: true,
        target: { select: { hairstyleId: true, targetKey: true } },
        attempts: {
          where: { verdict: "HUMAN_APPROVAL" },
          orderBy: { attemptNumber: "desc" },
          take: 1,
          select: { id: true, jobId: true, attemptNumber: true, prompt: true, overallScore: true, artifactId: true, aiGatePassed: true, publicationTierPassed: true, qaJson: true,
            artifact: { select: { id: true, kind: true, storageKey: true, checksum: true } } },
        },
      },
    });
    if (!job) return { kind: "missing" as const };
    if (job.status !== "HUMAN_APPROVAL") return { kind: "state" as const, status: job.status };
    const approvedAttempt = job.attempts[0] ?? null;
    if (!approvedAttempt || !eligibleRndApproval(approvedAttempt)) {
      return { kind: "gate" as const };
    }

    // Acquire the same style -> calibration -> actor lock order used by prompt promotion.
    if (job.target.hairstyleId && !await lockPromptStyle(tx, job.target.hairstyleId)) throw new Error("RND_APPROVAL_STYLE_MISSING");
    await lockCalibration(tx);
    if (!await lockActiveAdmin(tx, session.user.id)) return { kind: "unauthorized" as const };

    // Compare-and-set the approval state before any side effects. A concurrent
    // approve/reject request can win this transition only once.
    const claimed = await tx.rnDJob.updateMany({
      where: { id: jobId, status: "HUMAN_APPROVAL" },
      data: { status: "COMPLETED", completedAt: new Date() },
    });
    if (claimed.count !== 1) return { kind: "state" as const, status: "CHANGED" };

    if (job.target.hairstyleId) {
      const existingPrompt = await tx.promptVersion.findUnique({
        where: { sourceRnDAttemptId: approvedAttempt.id },
        select: { id: true },
      });

      if (!existingPrompt) {
        const latest = await tx.promptVersion.findFirst({
          where: { hairstyleId: job.target.hairstyleId },
          orderBy: { version: "desc" },
          select: { version: true },
        });
        const version = (latest?.version ?? 0) + 1;
        const score = approvedAttempt.overallScore == null ? "n/a" : String(approvedAttempt.overallScore);
        await tx.promptVersion.create({
          data: {
            hairstyleId: job.target.hairstyleId,
            version,
            prompt: approvedAttempt.prompt,
            status: "DRAFT",
            qaStatus: "TESTING",
            notes: [
              "Automatically imported from an approved R&D attempt.",
              `R&D target: ${job.target.targetKey}`,
              `R&D attempt: ${approvedAttempt.id} (attempt ${approvedAttempt.attemptNumber})`,
              `Automated QA overall: ${score}`,
              "This prompt is a candidate only; it is not activated for customer production until calibration validation passes.",
            ].join("\n"),
            sourceRnDAttemptId: approvedAttempt.id,
          },
        });
      }
    }

    await tx.rnDTarget.update({ where: { id: job.targetId }, data: { status: "APPROVED" } });
    const saved = await tx.rnDAttempt.updateMany({ where: { id: approvedAttempt.id, jobId, verdict: "HUMAN_APPROVAL" },
      data: { verdict: "APPROVED", qaJson: { ...(approvedAttempt.qaJson as Record<string, unknown>), humanApproval: humanApprovalProof(approvedAttempt, session.user.id) } } });
    if (saved.count !== 1) throw new Error("RND_APPROVAL_ATTEMPT_CHANGED");
    return { kind: "ok" as const, importedPrompt: Boolean(job.target.hairstyleId && approvedAttempt) };
  });

  if (result.kind === "unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (result.kind === "missing") return NextResponse.json({ error: "Job not found" }, { status: 404 });
  if (result.kind === "gate") return NextResponse.json({ error: "Approved attempt is missing or has not passed QA gates" }, { status: 409 });
  if (result.kind === "state") return NextResponse.json({ error: "Job is not awaiting human approval", status: result.status }, { status: 409 });
  return NextResponse.json({ ok: true, promptImported: result.importedPrompt });
}
