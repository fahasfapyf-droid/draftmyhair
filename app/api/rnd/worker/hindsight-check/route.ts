import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { requireRndWorker } from "@/lib/rnd/worker-auth";
import { hindsightConfigurationStatus, inspectRndOutcome, recallRndHistoryDetailed } from "@/lib/rnd/hindsight";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (process.env.VERCEL_ENV !== "preview" || process.env.VERCEL_GIT_COMMIT_REF !== "rnd/agent-learning-deerflow-v1") {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: { "cache-control": "no-store" } });
  }
  const session = await auth();
  const isAdmin = Boolean(session?.user?.id && session.user.role === "ADMIN");
  if (!isAdmin) {
    const authResponse = requireRndWorker(request.headers.get("authorization"));
    if (authResponse) return authResponse;
  }
  const url = new URL(request.url);
  const hairstyle = url.searchParams.get("hairstyle")?.trim().slice(0, 80) || "Italian Bob";
  const defect = url.searchParams.get("defect")?.trim().slice(0, 300) || "style accuracy and identity preservation";
  const status = hindsightConfigurationStatus();
  const jobId = url.searchParams.get("jobId")?.trim() ?? "";
  const attemptNumber = Number(url.searchParams.get("attemptNumber"));
  const outcome = jobId && Number.isInteger(attemptNumber) && attemptNumber > 0
    ? await inspectRndOutcome(jobId, attemptNumber)
    : null;
  const targetKey = url.searchParams.get("targetKey")?.trim().slice(0, 160) || null;
  const hairstyleId = url.searchParams.get("hairstyleId")?.trim().slice(0, 128) || null;
  const recall = await recallRndHistoryDetailed(
    `Draft My Hair historical R&D evidence. Hairstyle: ${hairstyle}. Hairstyle ID: ${hairstyleId ?? "unspecified"}. Target key: ${targetKey ?? "unspecified"}. Retrieve successful and failed generation experiments, observed defects, identity preservation, hair-only integrity, style accuracy and targeted refinements. Defect focus: ${defect}. Historical evidence is advisory only.`,
    targetKey || hairstyleId ? { targetKey, hairstyleId } : undefined
  );
  return NextResponse.json({
    ok: (recall.status === "ok" || recall.status === "empty") && (!outcome || outcome.status === "found"),
    configuration: status,
    status: recall.status,
    httpStatus: recall.httpStatus,
    diagnostic: recall.diagnostic ?? null,
    recalledCount: recall.evidence.length,
    evidence: recall.evidence.map(({ id, type, context, text }) => ({ id, type, context, text: text.slice(0, 700) })),
    outcome,
    checkedAt: new Date().toISOString(),
  }, { headers: { "cache-control": "no-store" } });
}
