import { NextResponse } from "next/server";
import { requireRndWorker } from "@/lib/rnd/worker-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const authResponse = requireRndWorker(request.headers.get("authorization"));
  if (authResponse) return authResponse;

  return NextResponse.json({
    code: "RND_LEGACY_AGENT_CLAIM_DISABLED",
    replacement: "/api/rnd/worker/claim",
  }, { status: 410 });
}
