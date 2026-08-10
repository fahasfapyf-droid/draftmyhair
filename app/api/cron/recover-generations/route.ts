import { NextResponse } from "next/server";

import { recoverStaleGenerations } from "@/lib/services/generation-recovery.service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error("CRON_SECRET is not configured.");
    return NextResponse.json(
      { success: false, error: "Cron secret is not configured." },
      { status: 503 }
    );
  }

  const authorization = request.headers.get("authorization");

  if (authorization !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { success: false, error: "Unauthorized." },
      { status: 401 }
    );
  }

  try {
    const summary = await recoverStaleGenerations();

    return NextResponse.json({
      success: true,
      ...summary,
    });
  } catch (error) {
    console.error("Stale generation sweep failed:", error);

    return NextResponse.json(
      { success: false, error: "Recovery sweep failed." },
      { status: 500 }
    );
  }
}
