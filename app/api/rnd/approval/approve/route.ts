import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { reconcileRndCampaignLifecycle } from "@/lib/rnd/campaign-lifecycle";

export const runtime = "nodejs";
const PRODUCTION_PROMOTION_URL = process.env.PRODUCTION_PROMOTION_URL ?? "https://draftmyhair.com/api/internal/prompt-promote";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  const jobId = typeof body?.jobId === "string" ? body.jobId : null;
  if (!jobId) return NextResponse.json({ error: "jobId is required" }, { status: 400 });

  const source = await prisma.rnDJob.findUnique({
    where: { id: jobId },
    select: {
      id: true, targetId: true, status: true,
      target: { select: { hairstyleId: true, targetKey: true, campaignId: true } },
      attempts: { where: { verdict: "HUMAN_APPROVAL" }, orderBy: { attemptNumber: "desc" }, take: 1,
        select: { id: true, attemptNumber: true, prompt: true, overallScore: true } },
    },
  });

  if (!source) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  if (source.status !== "HUMAN_APPROVAL") return NextResponse.json({ error: "Job is not awaiting human approval", status: source.status }, { status: 409 });
  const approvedAttempt = source.attempts[0] ?? null;
  const sourceHairstyle = source.target.hairstyleId
    ? await prisma.hairstyle.findUnique({ where: { id: source.target.hairstyleId }, select: { promptKey: true } })
    : null;
  if (!source.target.hairstyleId || !approvedAttempt || !sourceHairstyle?.promptKey) {
    return NextResponse.json({ error: "Approved R&D attempt is missing hairstyle or prompt source" }, { status: 409 });
  }

  const promotionSecret = process.env.PROMPT_PROMOTION_SECRET;
  if (!promotionSecret) return NextResponse.json({ error: "Production promotion is not configured" }, { status: 503 });

  let promotion: any;
  try {
    const response = await fetch(PRODUCTION_PROMOTION_URL, {
      method: "POST", cache: "no-store",
      headers: { "content-type": "application/json", "x-dmh-promotion-secret": promotionSecret },
      body: JSON.stringify({ promptKey: sourceHairstyle.promptKey, prompt: approvedAttempt.prompt,
        sourceAttemptId: approvedAttempt.id, sourceJobId: source.id, qaScore: approvedAttempt.overallScore }),
    });
    promotion = await response.json().catch(() => ({ error: "Invalid promotion response" }));
    if (!response.ok) return NextResponse.json({ error: "Production promotion failed", details: promotion }, { status: 502 });
  } catch (error) {
    return NextResponse.json({ error: "Production promotion request failed", details: error instanceof Error ? error.message : "Unknown error" }, { status: 502 });
  }

  const result = await prisma.$transaction(async (tx) => {
    const existingPrompt = await tx.promptVersion.findUnique({ where: { sourceRnDAttemptId: approvedAttempt.id }, select: { id: true } });
    if (!existingPrompt) {
      const latest = await tx.promptVersion.findFirst({ where: { hairstyleId: source.target.hairstyleId! }, orderBy: { version: "desc" }, select: { version: true } });
      const version = (latest?.version ?? 0) + 1;
      const score = approvedAttempt.overallScore == null ? "n/a" : String(approvedAttempt.overallScore);
      await tx.promptVersion.create({ data: {
        hairstyleId: source.target.hairstyleId!, version, prompt: approvedAttempt.prompt, status: "DRAFT", qaStatus: "TESTING",
        notes: ["Automatically imported from an approved R&D attempt.", `R&D target: ${source.target.targetKey}`, `R&D attempt: ${approvedAttempt.id} (attempt ${approvedAttempt.attemptNumber})`, `Automated QA overall: ${score}`, `Production promotion: ${promotion.promptVersionId ?? "completed"}`].join("\n"),
        sourceRnDAttemptId: approvedAttempt.id,
      } });
    }
    await tx.rnDJob.update({ where: { id: jobId }, data: { status: "COMPLETED", completedAt: new Date() } });
    await tx.rnDTarget.update({ where: { id: source.targetId }, data: { status: "APPROVED" } });
    await tx.rnDAttempt.updateMany({ where: { jobId, verdict: "HUMAN_APPROVAL" }, data: { verdict: "APPROVED" } });
    return { campaignStatus: await reconcileRndCampaignLifecycle(tx, source.target.campaignId) };
  });

  return NextResponse.json({ ok: true, productionPromotion: promotion, campaignStatus: result.campaignStatus });
}
