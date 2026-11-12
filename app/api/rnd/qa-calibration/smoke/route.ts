import { NextResponse } from "next/server";
import { auth } from "@/auth";
export const runtime = "nodejs";
/** Old smoke writer fabricated reviewer labels and cannot certify calibration. */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 });
  return NextResponse.json({ code: "RND_LEGACY_CALIBRATION_SMOKE_DISABLED" }, { status: 410 });
}
