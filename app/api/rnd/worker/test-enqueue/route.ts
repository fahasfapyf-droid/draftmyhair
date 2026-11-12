import { NextResponse } from "next/server";
import { requireRndWorker } from "@/lib/rnd/worker-auth";

export const runtime = "nodejs";

/** Worker credentials cannot create campaigns, catalog styles or queue jobs. */
export async function POST(request: Request) {
  const denied = requireRndWorker(request.headers.get("authorization"));
  if (denied) return denied;
  return NextResponse.json({ code: "RND_LEGACY_WORKER_ENQUEUE_DISABLED", canonicalProducer: "/api/rnd/producer/autonomous-enqueue" }, { status: 410 });
}
