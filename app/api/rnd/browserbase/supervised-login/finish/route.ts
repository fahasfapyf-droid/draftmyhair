import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  getSupervisedGeminiSession,
  releaseSupervisedGeminiSession,
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
    if (current.status !== "RUNNING" && current.status !== "PENDING") {
      return NextResponse.json({ error: "Browserbase session is no longer active.", status: current.status }, { status: 409 });
    }
    const released = await releaseSupervisedGeminiSession(sessionId);

    // Browserbase Context persistence is asynchronous after a session release.
    // Give the Context a short settling window before opening the calibration
    // session, then retry read-only calibration if the first check still sees
    // an unauthenticated Gemini UI. This avoids racing cookie/storage commit.
    await new Promise((resolve) => setTimeout(resolve, 8_000));

    let lastInvocationId = "";
    let lastCalibration: any = null;

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const started = await invokeGeminiCalibration();
      const invocationId = typeof started?.id === "string" ? started.id : "";
      if (!invocationId) throw new Error("Browserbase calibration invocation did not return an invocation id.");
      lastInvocationId = invocationId;

      const deadline = Date.now() + 20_000;
      while (Date.now() < deadline) {
        const result = await getGeminiCalibrationInvocation(invocationId);

        if (result?.status === "COMPLETED") {
          lastCalibration = result.results;
          const authenticated = Boolean(result?.results?.ui?.authenticatedLikely);

          if (authenticated) {
            return NextResponse.json({
              ok: true,
              sessionId,
              released: released.status,
              invocationId,
              calibration: result.results,
            }, { headers: { "Cache-Control": "no-store" } });
          }

          // If the UI is still unauthenticated, allow Context persistence more
          // time and perform another read-only calibration against the same
          // persistent Context.
          if (attempt < 3) {
            await new Promise((resolve) => setTimeout(resolve, 5_000));
            break;
          }

          return NextResponse.json({
            ok: true,
            sessionId,
            released: released.status,
            invocationId,
            calibration: result.results,
          }, { headers: { "Cache-Control": "no-store" } });
        }

        if (result?.status === "FAILED" || result?.status === "TIMED_OUT") {
          if (attempt < 3) {
            await new Promise((resolve) => setTimeout(resolve, 5_000));
            break;
          }

          return NextResponse.json({
            ok: false,
            sessionId,
            released: released.status,
            invocationId,
            error: result.error || "Gemini calibration failed after Context release.",
          }, { status: 502 });
        }

        await new Promise((resolve) => setTimeout(resolve, 2_000));
      }
    }

    return NextResponse.json({
      ok: true,
      sessionId,
      released: released.status,
      invocationId: lastInvocationId,
      calibration: lastCalibration,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("R&D supervised login finish failed", error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Could not finish Browserbase supervised login.",
    }, { status: 500 });
  }
}
