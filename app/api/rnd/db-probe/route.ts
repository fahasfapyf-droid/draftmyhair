import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
export const runtime = "nodejs";
export async function GET() {
  const identity = await prisma.$queryRaw<Array<any>>`SELECT current_database() AS database, current_schema() AS schema, current_setting('neon.branch_id', true) AS "neonBranchId", current_setting('neon.project_id', true) AS "neonProjectId"`;
  const migration = await prisma.$queryRaw<Array<any>>`SELECT migration_name, finished_at FROM "_prisma_migrations" WHERE migration_name = '20261001093000_add_rnd_human_review'`;
  return NextResponse.json({ identity: identity[0] ?? null, migration: migration[0] ?? null });
}
