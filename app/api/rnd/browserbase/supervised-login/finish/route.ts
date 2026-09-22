import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  inspectSupervisedGeminiSession,
  releaseSupervisedGeminiSession,
} from "@/lib/rnd/browserbase-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const sessionId = typeof body?.sessionId === "string" ? body.sessionId.trim() : "";
  if (!sessionId) return NextResponse.json({ error: "sessionId is required" }, { status: 400 });

  try {
    const inspected = await inspectSupervisedGeminiSession(sessionId);
    const released = await releaseSupervisedGeminiSession(sessionId);
    return NextResponse.json({
      ok: true,
      sessionId,
      released: released.status,
      verifiedBeforeRelease: inspected.ui,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("R&D supervised login finish failed", error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Could not finish Browserbase supervised login.",
    }, { status: 500 });
  }
}
