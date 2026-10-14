import { NextResponse } from "next/server";
import { requireRndWorker } from "@/lib/rnd/worker-auth";
import { probeRndHindsight } from "@/lib/rnd/hindsight";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authResponse = requireRndWorker(request.headers.get("authorization"));
  if (authResponse) return authResponse;
  const result = await probeRndHindsight();
  return NextResponse.json({ ok: result.ok, enabled: result.enabled, httpStatus: result.httpStatus, recordCount: result.recordCount });
}
