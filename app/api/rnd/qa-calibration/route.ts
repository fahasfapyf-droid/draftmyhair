import { NextResponse } from "next/server";
import { requireRndWorker } from "@/lib/rnd/worker-auth";

export const runtime = "nodejs";

// Human calibration ratings are ground truth. Never expose them through a
// worker-authenticated endpoint: workers must not be able to inspect or game
// the reference scores used to evaluate their own QA.
export { POST } from "./review/route";

export async function GET(request: Request) {
  const unauthorized = requireRndWorker(request.headers.get("authorization"));
  if (unauthorized) return unauthorized;

  return NextResponse.json(
    { code: "RND_CALIBRATION_WORKER_READ_DISABLED" },
    { status: 410, headers: { "cache-control": "no-store" } },
  );
}
