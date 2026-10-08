import { NextResponse } from "next/server";
import {
  requireRndWorker,
  RND_WORKER_PROTOCOL_VERSION,
} from "@/lib/rnd/worker-auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const authResponse = requireRndWorker(request.headers.get("authorization"));
  if (authResponse) return authResponse;

  return NextResponse.json({
    ok: true,
    protocolVersion: RND_WORKER_PROTOCOL_VERSION,
    serverTime: new Date().toISOString(),
  });
}
