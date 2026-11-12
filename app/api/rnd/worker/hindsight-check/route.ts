import { NextResponse } from "next/server";
import { requireRndWorker } from "@/lib/rnd/worker-auth";
import { hindsightConfigurationStatus, recallRndHistoryDetailed } from "@/lib/rnd/hindsight";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authResponse = requireRndWorker(request.headers.get("authorization"));
  if (authResponse) return authResponse;
  const url = new URL(request.url);
  const hairstyle = url.searchParams.get("hairstyle")?.trim().slice(0, 80) || "Italian Bob";
  const defect = url.searchParams.get("defect")?.trim().slice(0, 300) || "style accuracy and identity preservation";
  const status = hindsightConfigurationStatus();
  const recall = await recallRndHistoryDetailed(
    `Draft My Hair historical R&D evidence. Hairstyle: ${hairstyle}. Retrieve successful and failed generation experiments, observed defects, identity preservation, hair-only integrity, style accuracy and targeted refinements. Defect focus: ${defect}. Historical evidence is advisory only.`
  );
  return NextResponse.json({
    ok: recall.status === "ok" || recall.status === "empty",
    configuration: status,
    status: recall.status,
    httpStatus: recall.httpStatus,
    recalledCount: recall.evidence.length,
    evidence: recall.evidence.map(({ id, type, context, text }) => ({ id, type, context, text: text.slice(0, 700) })),
    checkedAt: new Date().toISOString(),
  }, { headers: { "cache-control": "no-store" } });
}
