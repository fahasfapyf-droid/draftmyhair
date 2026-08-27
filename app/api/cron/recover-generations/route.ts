import { NextResponse } from "next/server";

import { recoverStaleGenerations } from "@/lib/services/generation-recovery.service";
import { expireOldGeneratedImages } from "@/lib/services/generated-image-retention.service";

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
    const recovery = await recoverStaleGenerations();
    const retention = await expireOldGeneratedImages();

    return NextResponse.json({
      success: true,
      ...recovery,
      generatedImages: retention,
    });
  } catch (error) {
    console.error("Generation maintenance sweep failed:", error);

    return NextResponse.json(
      { success: false, error: "Maintenance sweep failed." },
      { status: 500 }
    );
  }
}
