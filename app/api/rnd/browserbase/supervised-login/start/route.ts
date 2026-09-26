import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createSupervisedGeminiSession } from "@/lib/rnd/browserbase-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await createSupervisedGeminiSession();
    return NextResponse.json({ ok: true, ...result }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("R&D supervised login start failed", error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Could not start Browserbase supervised login.",
    }, { status: 500 });
  }
}
