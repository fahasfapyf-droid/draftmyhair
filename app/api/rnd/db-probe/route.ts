import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  const identity = await prisma.$queryRaw<Array<any>>`SELECT current_database() AS database, current_schema() AS schema, current_setting('neon.branch_id', true) AS "neonBranchId", current_setting('neon.project_id', true) AS "neonProjectId"`;
  const migration = await prisma.$queryRaw<Array<any>>`SELECT migration_name, finished_at FROM "_prisma_migrations" WHERE migration_name = '20261001093000_add_rnd_human_review'`;
  const column = await prisma.$queryRaw<Array<any>>`SELECT column_name FROM information_schema.columns WHERE table_name = 'RnDAttempt' AND column_name = 'adaptiveDecision'`;
  const enumValues = await prisma.$queryRaw<Array<any>>`SELECT t.typname AS type_name, e.enumlabel AS value FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname IN ('RnDJobStatus','RnDTargetStatus','RnDAttemptVerdict') AND e.enumlabel = 'HUMAN_REVIEW'`;
  return NextResponse.json({ ok: true, identity: identity[0] ?? null, migration: migration[0] ?? null, column: column[0] ?? null, enumCount: enumValues.length });
}
