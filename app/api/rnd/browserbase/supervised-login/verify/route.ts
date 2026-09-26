import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  getSupervisedGeminiSession,
  invokeGeminiCalibration,
  getGeminiCalibrationInvocation,
} from "@/lib/rnd/browserbase-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 90;

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const sessionId = typeof body?.sessionId === "string" ? body.sessionId.trim() : "";
  if (!sessionId) return NextResponse.json({ error: "sessionId is required" }, { status: 400 });

  try {
    const current = await getSupervisedGeminiSession(sessionId);
    if (current.status !== "COMPLETED") {
      return NextResponse.json({
        error: "Release the supervised session first so the Context can be reused by the calibration Function.",
        status: current.status,
      }, { status: 409 });
    }

    const started = await invokeGeminiCalibration();
    const invocationId = typeof started?.id === "string" ? started.id : "";
    if (!invocationId) throw new Error("Browserbase calibration invocation did not return an invocation id.");

    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
      const result = await getGeminiCalibrationInvocation(invocationId);
      if (result?.status === "COMPLETED") {
        return NextResponse.json({
          ok: true,
          invocationId,
          result: result.results,
        }, { headers: { "Cache-Control": "no-store" } });
      }
      if (result?.status === "FAILED" || result?.status === "TIMED_OUT") {
        return NextResponse.json({
          ok: false,
          invocationId,
          error: result.error || "Gemini calibration failed.",
        }, { status: 502 });
      }
      await new Promise((resolve) => setTimeout(resolve, 2_000));
    }

    return NextResponse.json({
      ok: false,
      invocationId,
      error: "Gemini calibration is still running. Check Browserbase invocation status before retrying.",
    }, { status: 202 });
  } catch (error) {
    console.error("R&D Gemini calibration verification failed", error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Could not verify Gemini authentication.",
    }, { status: 500 });
  }
}
