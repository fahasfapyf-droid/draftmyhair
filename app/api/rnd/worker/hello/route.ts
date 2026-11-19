import { NextResponse } from "next/server";
import {
  requireRndWorker,
  RND_WORKER_PROTOCOL_VERSION,
} from "@/lib/rnd/worker-auth";
import {
  resolveRndWorkerClaimJobId,
  RND_WORKER_ISOLATED_JOB_ID_HEADER,
} from "@/lib/rnd/worker-claim-policy";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const authResponse = requireRndWorker(request.headers.get("authorization"));
  if (authResponse) return authResponse;

  // Validate the same server-side single-job allowlist before the worker
  // launches Chrome or reports itself online.
  const claimPolicy = resolveRndWorkerClaimJobId(
    process.env.RND_WORKER_ISOLATED_JOB_ID,
    request.headers.get(RND_WORKER_ISOLATED_JOB_ID_HEADER),
  );
  if (!claimPolicy.ok) return NextResponse.json({ code: claimPolicy.code }, { status: claimPolicy.status });

  return NextResponse.json({
    ok: true,
    protocolVersion: RND_WORKER_PROTOCOL_VERSION,
    serverTime: new Date().toISOString(),
  });
}
