import { NextResponse } from "next/server";
import {
  requireRndWorker,
  RND_WORKER_PROTOCOL_VERSION,
} from "@/lib/rnd/worker-auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    requireRndWorker(request.headers.get("authorization"));
  } catch (response) {
    if (response instanceof Response) return response;
    throw response;
  }

  return NextResponse.json({
    ok: true,
    protocolVersion: RND_WORKER_PROTOCOL_VERSION,
    serverTime: new Date().toISOString(),
  });
}
