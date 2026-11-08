import { NextResponse } from "next/server";

import { auth } from "@/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Reports non-secret database routing metadata for Preview isolation audits.
 * Does not instantiate Prisma, open a database connection, or execute SQL.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403, headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    return NextResponse.json(
      { ok: false, error: "DATABASE_URL is not configured" },
      { status: 503, headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  }

  try {
    const databaseUrl = new URL(connectionString);
    const databaseName = decodeURIComponent(databaseUrl.pathname.replace(/^\//, ""));

    return NextResponse.json(
      {
        ok: true,
        hostname: databaseUrl.hostname,
        databaseName: databaseName || null,
        protocol: databaseUrl.protocol,
        source: "runtime-environment",
        readOnly: true,
        databaseConnectionOpened: false,
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch {
    return NextResponse.json(
      { ok: false, error: "DATABASE_URL is not a valid URL" },
      { status: 503, headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  }
}
