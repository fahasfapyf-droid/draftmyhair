import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireRndWorker } from "@/lib/rnd/worker-auth";
import {
  hindsightConfigurationStatus,
  recallRndHistoryDetailed,
} from "@/lib/rnd/hindsight";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_BRANCH = "rnd/agent-learning-deerflow-v1";
const EXPECTED_DATABASE = "dmh_rnd";
const EXPECTED_ROLE = "dmh_rnd_app";
const EXPECTED_DATABASE_HOST =
  "ep-hidden-hill-b8mvozbe-pooler.c-14.us-east-1.aws.neon.tech";
const EXPECTED_BLOB_STORE_ID = "store_ErwFOk17AEWS4n1e";

const noStore = {
  "Cache-Control": "private, no-store, max-age=0",
  Pragma: "no-cache",
  "X-Content-Type-Options": "nosniff",
};

function databaseUrlIdentity(raw: string | undefined) {
  if (!raw?.trim()) return { configured: false };

  try {
    const url = new URL(raw);
    return {
      configured: true,
      parseable: true,
      host: url.hostname,
      port: url.port || "5432",
      database: decodeURIComponent(url.pathname.replace(/^\/+/, "")),
      role: decodeURIComponent(url.username),
    };
  } catch {
    return { configured: true, parseable: false };
  }
}

function blobTokenIdentity(raw: string | undefined) {
  const token = raw?.trim() ?? "";
  const match = token.match(/^vercel_blob_rw_(store_[A-Za-z0-9]+)_/);
  const storeId = match?.[1] ?? null;

  return {
    configured: Boolean(token),
    recognizedFormat: Boolean(match),
    storeId,
    expectedStoreId: EXPECTED_BLOB_STORE_ID,
    matchesExpectedStore: storeId === EXPECTED_BLOB_STORE_ID,
  };
}

async function inspectDatabase() {
  const configured = databaseUrlIdentity(process.env.DATABASE_URL);

  try {
    const rows = await prisma.$queryRawUnsafe<Array<{
      database_name: string;
      database_role: string;
      server_address: string | null;
      server_port: number | null;
      schema_name: string | null;
      server_version: string;
    }>>(
      "SELECT current_database() AS database_name, current_user AS database_role, " +
      "inet_server_addr()::text AS server_address, inet_server_port() AS server_port, " +
      "current_schema() AS schema_name, current_setting('server_version') AS server_version"
    );

    const actual = rows[0] ?? null;
    return {
      datasource: "Prisma default client (DATABASE_URL)",
      configuredUrl: configured,
      querySucceeded: Boolean(actual),
      actual,
      matchesExpectedIsolatedDatabase: Boolean(
        actual &&
        actual.database_name === EXPECTED_DATABASE &&
        actual.database_role === EXPECTED_ROLE &&
        (configured as { host?: string }).host === EXPECTED_DATABASE_HOST
      ),
      expected: {
        host: EXPECTED_DATABASE_HOST,
        database: EXPECTED_DATABASE,
        role: EXPECTED_ROLE,
      },
    };
  } catch (error) {
    return {
      datasource: "Prisma default client (DATABASE_URL)",
      configuredUrl: configured,
      querySucceeded: false,
      errorName: error instanceof Error ? error.name : "UnknownError",
      expected: {
        host: EXPECTED_DATABASE_HOST,
        database: EXPECTED_DATABASE,
        role: EXPECTED_ROLE,
      },
    };
  }
}

async function inspectHindsight() {
  const rawUrl = process.env.HINDSIGHT_API_URL?.trim() ?? "";
  let apiHost: string | null = null;
  try {
    apiHost = rawUrl ? new URL(rawUrl).host : null;
  } catch {
    apiHost = null;
  }

  const configuration = hindsightConfigurationStatus();
  const bankId = process.env.HINDSIGHT_RND_BANK?.trim() || "draftmyhair-rnd";

  if (configuration !== "ok") {
    return {
      configuration,
      apiHost,
      bankId,
      authenticatedRecallSucceeded: false,
      recallStatus: configuration,
      httpStatus: null,
      evidenceCount: null,
    };
  }

  try {
    const result = await recallRndHistoryDetailed(
      "Draft My Hair Preview read-only connectivity diagnostic. Verify access to the configured R&D memory bank. Do not retain or change any memory."
    );
    return {
      configuration,
      apiHost,
      bankId,
      authenticatedRecallSucceeded:
        result.status === "ok" || result.status === "empty",
      recallStatus: result.status,
      httpStatus: result.httpStatus,
      evidenceCount: result.evidence.length,
    };
  } catch (error) {
    return {
      configuration,
      apiHost,
      bankId,
      authenticatedRecallSucceeded: false,
      recallStatus: "request_failed",
      httpStatus: null,
      evidenceCount: null,
      errorName: error instanceof Error ? error.name : "UnknownError",
    };
  }
}

export async function GET(request: Request) {
  if (
    process.env.VERCEL_ENV !== "preview" ||
    process.env.VERCEL_GIT_COMMIT_REF !== ALLOWED_BRANCH
  ) {
    return new NextResponse("Not found", { status: 404, headers: noStore });
  }

  const session = await auth();
  const isAdmin = Boolean(session?.user?.id && session.user.role === "ADMIN");
  if (!isAdmin) {
    const authResponse = requireRndWorker(request.headers.get("authorization"));
    if (authResponse) return authResponse;
  }

  const [database, hindsight] = await Promise.all([
    inspectDatabase(),
    inspectHindsight(),
  ]);

  const blob = blobTokenIdentity(process.env.RND_BLOB_READ_WRITE_TOKEN);

  return NextResponse.json(
    {
      ok:
        database.querySucceeded &&
        database.matchesExpectedIsolatedDatabase &&
        blob.matchesExpectedStore &&
        hindsight.authenticatedRecallSucceeded,
      environment: process.env.VERCEL_ENV,
      branch: process.env.VERCEL_GIT_COMMIT_REF,
      deploymentId: process.env.VERCEL_DEPLOYMENT_ID ?? null,
      database,
      blob,
      hindsight,
      checkedAt: new Date().toISOString(),
      sideEffects: "read-only database SELECT and authenticated Hindsight recall; no Blob objects accessed",
    },
    { headers: noStore }
  );
}
