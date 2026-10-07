import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getSupervisedGeminiSession } from "@/lib/rnd/browserbase-session";

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
    const result = await getSupervisedGeminiSession(sessionId);
    return NextResponse.json({
      ok: true,
      sessionId: result.id,
      status: result.status,
      expiresAt: result.expiresAt,
      contextId: result.contextId,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("R&D supervised login status failed", error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Could not inspect Browserbase session.",
    }, { status: 500 });
  }
}
