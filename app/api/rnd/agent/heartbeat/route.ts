import { NextResponse } from "next/server";
import { requireRndWorker } from "@/lib/rnd/worker-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const authResponse = requireRndWorker(request.headers.get("authorization"));
  if (authResponse) return authResponse;

  return NextResponse.json({
    code: "RND_LEGACY_AGENT_HEARTBEAT_DISABLED",
    replacement: "/api/rnd/worker/heartbeat",
  }, { status: 410 });
}
