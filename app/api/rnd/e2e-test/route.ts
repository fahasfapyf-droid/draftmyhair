import { NextResponse } from "next/server";
import { auth } from "@/auth";

export const runtime = "nodejs";

/** Retired Protocol 1/Vertex harness: never enqueue, generate or seed credentials. */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 });
  return NextResponse.json({ code: "RND_LEGACY_E2E_DISABLED", protocolVersion: "2", canonicalWorker: "tools/rnd-worker/worker.ts" }, { status: 410 });
}
