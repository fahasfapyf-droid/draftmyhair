import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  const rows = await prisma.$queryRaw<Array<{
    database: string;
    schema: string;
    neonBranchId: string | null;
    neonProjectId: string | null;
  }>>`SELECT current_database() AS database, current_schema() AS schema, current_setting('neon.branch_id', true) AS "neonBranchId", current_setting('neon.project_id', true) AS "neonProjectId"`;
  return NextResponse.json({ ok: true, database: rows[0] ?? null });
}
