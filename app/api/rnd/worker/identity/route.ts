import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRndWorker } from "@/lib/rnd/worker-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EXPECTED = {
  branch: "rnd/agent-learning-deerflow-v1",
  vercelUrlPattern: /^draftmyhair-[a-z0-9-]+-draftmyhair\.vercel\.app$/i,
  neonProjectId: "flat-block-22639366",
  neonBranchId: "br-summer-forest-b8qqkw44",
  endpointHost: "ep-hidden-hill-b8mvozbe-pooler.c-14.us-east-1.aws.neon.tech",
  port: "5432",
  database: "dmh_rnd",
  role: "dmh_rnd_app",
} as const;

type ConnectionIdentity = {
  endpointHost: string;
  port: string;
  database: string;
  role: string;
};

function isExactPreviewScope() {
  const deploymentUrl = process.env.VERCEL_URL?.trim() ?? "";
  return process.env.VERCEL_ENV === "preview" &&
    process.env.VERCEL_GIT_COMMIT_REF === EXPECTED.branch &&
    EXPECTED.vercelUrlPattern.test(deploymentUrl) &&
    process.env.RND_DATABASE_EXPECTED_PROJECT_ID === EXPECTED.neonProjectId &&
    process.env.RND_DATABASE_EXPECTED_BRANCH_ID === EXPECTED.neonBranchId &&
    process.env.RND_DATABASE_EXPECTED_ENDPOINT_HOST === EXPECTED.endpointHost &&
    process.env.RND_DATABASE_EXPECTED_PORT === EXPECTED.port &&
    process.env.RND_DATABASE_EXPECTED_DATABASE === EXPECTED.database &&
    process.env.RND_DATABASE_EXPECTED_ROLE === EXPECTED.role;
}

function readConnectionIdentity(value: string | undefined): ConnectionIdentity | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") return null;
    return {
      endpointHost: url.hostname.toLowerCase(),
      port: url.port || "5432",
      database: decodeURIComponent(url.pathname.replace(/^\/+/, "")),
      role: decodeURIComponent(url.username),
    };
  } catch {
    return null;
  }
}

function noStoreJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}

/**
 * One-time, read-only Preview diagnostic. It is intentionally restricted to
 * the Issue 71 R&D Preview branch and returns no connection string or secret.
 */
export async function POST(request: Request) {
  const authResponse = requireRndWorker(request.headers.get("authorization"));
  if (authResponse) return authResponse;

  if (!isExactPreviewScope()) {
    return noStoreJson({ code: "NOT_FOUND" }, 404);
  }

  const configured = readConnectionIdentity(process.env.DATABASE_URL);
  if (!configured ||
      configured.endpointHost !== EXPECTED.endpointHost ||
      configured.port !== EXPECTED.port ||
      configured.database !== EXPECTED.database ||
      configured.role !== EXPECTED.role) {
    return noStoreJson({ code: "RND_PREVIEW_DATABASE_CONFIGURATION_MISMATCH" }, 503);
  }

  try {
    const rows = await prisma.$queryRaw<Array<{ database_name: string; role_name: string }>>`SELECT
      current_database() AS database_name,
      current_user AS role_name`;
    const identity = rows[0];

    if (!identity ||
        identity.database_name !== EXPECTED.database ||
        identity.role_name !== EXPECTED.role) {
      return noStoreJson({ code: "RND_PREVIEW_DATABASE_IDENTITY_MISMATCH" }, 503);
    }

    return noStoreJson({
      ok: true,
      currentDatabase: identity.database_name,
      currentUser: identity.role_name,
      endpointHost: configured.endpointHost,
      port: configured.port,
    });
  } catch {
    // Deliberately omit database errors, connection details, and stack traces.
    return noStoreJson({ code: "RND_PREVIEW_DATABASE_IDENTITY_QUERY_FAILED" }, 503);
  }
}
