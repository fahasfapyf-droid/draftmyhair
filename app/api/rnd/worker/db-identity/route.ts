import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRndWorker } from "@/lib/rnd/worker-auth";

export const runtime = "nodejs";

const EXPECTED_NEON_PROJECT_ID = "mute-pine-65530921";
const EXPECTED_NEON_BRANCH_ID = "br-crimson-bread-avik0zxl";

export async function GET(request: Request) {
  const authResponse = requireRndWorker(request.headers.get("authorization"));
  if (authResponse) return authResponse;

  const rows = await prisma.$queryRaw<Array<{
    database: string;
    schema: string;
    neonBranchId: string | null;
    neonProjectId: string | null;
  }>>`SELECT current_database() AS database, current_schema() AS schema, current_setting('neon.branch_id', true) AS "neonBranchId", current_setting('neon.project_id', true) AS "neonProjectId"`;

  const identity = rows[0] ?? null;
  const matches =
    identity?.neonProjectId === EXPECTED_NEON_PROJECT_ID &&
    identity?.neonBranchId === EXPECTED_NEON_BRANCH_ID;

  return NextResponse.json(
    {
      ok: matches,
      database: identity
        ? {
            database: identity.database,
            schema: identity.schema,
            neonBranchId: identity.neonBranchId,
            neonProjectId: identity.neonProjectId,
          }
        : null,
    },
    { status: matches ? 200 : 503 },
  );
}
