import { NextResponse } from "next/server";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const raw = process.env.DATABASE_URL;
  if (!raw) {
    return NextResponse.json({
      ok: false,
      stage: "configuration",
      databaseUrlPresent: false,
      message: "DATABASE_URL is not available to this deployment runtime.",
    }, { status: 503 });
  }

  try {
    const url = new URL(raw);
    return NextResponse.json({
      ok: true,
      stage: "target-identification-only",
      databaseUrlPresent: true,
      protocol: url.protocol,
      hostname: url.hostname,
      port: url.port || "default",
      databaseName: decodeURIComponent(url.pathname.replace(/^\//, "")) || "(not specified)",
      branch: process.env.VERCEL_GIT_COMMIT_REF ?? null,
      vercelEnvironment: process.env.VERCEL_ENV ?? null,
      connectionAttempted: false,
      note: "No database connection or query was performed. Verify this is a non-production Neon branch before any connectivity test.",
    }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch {
    return NextResponse.json({
      ok: false,
      stage: "configuration",
      databaseUrlPresent: true,
      urlParseable: false,
      connectionAttempted: false,
      message: "DATABASE_URL is present but is not a valid URL. Its value was not exposed.",
    }, { status: 503, headers: { "Cache-Control": "no-store, max-age=0" } });
  }
}
