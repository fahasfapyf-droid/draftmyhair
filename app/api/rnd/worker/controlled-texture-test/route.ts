import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { optimizeAutonomousPrompt } from "@/lib/rnd/autonomous-prompt";
import { requireRndWorker } from "@/lib/rnd/worker-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = requireRndWorker(request.headers.get("authorization"));
  if (auth) return auth;
  const body = await request.json().catch(() => null) as { jobId?: unknown } | null;
  const jobId = typeof body?.jobId === "string" ? body.jobId.trim() : "";
  if (!jobId) return NextResponse.json({ error: "jobId is required" }, { status: 400 });
  const job = await prisma.rnDJob.findUnique({ where: { id: jobId }, include: { target: true } });
  if (!job || job.target.targetKey !== "rnd-controlled-texture-branch-20261002") return NextResponse.json({ error: "controlled texture test job not found" }, { status: 404 });
  const style = await prisma.promptVersion.findFirst({ where: { status: "ACTIVE", hairstyleId: job.target.hairstyleId! }, orderBy: { version: "desc" }, select: { prompt: true, version: true } });
  if (!style) return NextResponse.json({ error: "active style prompt missing" }, { status: 503 });
  const decision = {
    action: "REFINE", category: "TEXTURE", property: "hair texture", strategy: "TEXTURE_MATCH_DEFINITION",
    instruction: "Correct only hair texture to the authoritative hairstyle definition; preserve shape, length, and all other properties.",
    reason: "ADAPTIVE_DECISION:{\"category\":\"TEXTURE\",\"property\":\"hair texture\",\"strategy\":\"TEXTURE_MATCH_DEFINITION\",\"regression\":false,\"plateau\":false}",
    regression: false, plateau: false, priorStrategies: [], evidence: {},
  };
  const built = await optimizeAutonomousPrompt({ instruction: "Italian Bob", currentPrompt: job.currentPrompt, defect: decision.instruction, attemptNumber: 2, authoritativeStylePrompt: style.prompt, strategyId: decision.strategy });
  await prisma.$transaction(async (tx) => {
    await tx.rnDAttempt.deleteMany({ where: { jobId, attemptNumber: 1 } });
    await tx.rnDAttempt.create({ data: { jobId, attemptNumber: 1, prompt: job.currentPrompt, promptRevision: "controlled-texture-setup", submittedAt: new Date(Date.now() - 2 * 60 * 1000), verdict: "REFINE", adaptiveDecision: decision } });
    await tx.rnDJob.update({ where: { id: jobId }, data: { status: "QUEUED", attemptCount: 1, currentPrompt: built.prompt, nextEligibleAt: null, leaseOwner: null, leaseExpiresAt: null, heartbeatAt: null, startedAt: null, completedAt: null, failureCode: null, failureMessage: null } });
    await tx.rnDTarget.update({ where: { id: job.targetId }, data: { status: "QUEUED", currentJobId: jobId } });
  });
  return NextResponse.json({ ok: true, jobId, promptLength: built.prompt.length, hasTextureBoundary: built.prompt.includes("TEXTURE-ONLY PRESERVATION BOUNDARY") });
}
