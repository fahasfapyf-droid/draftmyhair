import { createHash } from "node:crypto";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

/** Temporary R&D database-topology diagnostic. Remove after authentication diagnosis. */
export async function GET() {
  if (process.env.VERCEL_ENV !== "preview") {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  const databaseUrl = process.env.DATABASE_URL ?? "";
  const databaseUrlFingerprint = createHash("sha256")
    .update(databaseUrl)
    .digest("hex")
    .slice(0, 16);

  try {
    const rows = await prisma.$queryRawUnsafe<Array<{
      database_name: string;
      schema_name: string;
      neon_endpoint_id: string | null;
    }>>("SELECT current_database() AS database_name, current_schema() AS schema_name, current_setting('neon.endpoint_id', true) AS neon_endpoint_id");

    const db = rows[0];

    return NextResponse.json(
      {
        ok: true,
        environment: process.env.VERCEL_ENV,
        databaseUrlFingerprint,
        databaseName: db?.database_name ?? null,
        schemaName: db?.schema_name ?? null,
        neonEndpointId: db?.neon_endpoint_id ?? null,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json(
      {
        ok: false,
        environment: process.env.VERCEL_ENV,
        databaseUrlFingerprint,
        databaseReachable: false,
      },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
