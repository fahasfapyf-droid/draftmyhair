import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { transformSync } from "esbuild";

const secret = "fixture-password-must-never-be-returned";
const expectedHost = "ep-hidden-hill-b8mvozbe-pooler.c-14.us-east-1.aws.neon.tech";

function previewEnv(overrides: Record<string, string> = {}) {
  return {
    VERCEL_ENV: "preview",
    VERCEL_URL: "draftmyhair-fixture123-draftmyhair.vercel.app",
    VERCEL_GIT_COMMIT_REF: "rnd/agent-learning-deerflow-v1",
    RND_DATABASE_EXPECTED_PROJECT_ID: "flat-block-22639366",
    RND_DATABASE_EXPECTED_BRANCH_ID: "br-summer-forest-b8qqkw44",
    RND_DATABASE_EXPECTED_ENDPOINT_HOST: expectedHost,
    RND_DATABASE_EXPECTED_PORT: "5432",
    RND_DATABASE_EXPECTED_DATABASE: "dmh_rnd",
    RND_DATABASE_EXPECTED_ROLE: "dmh_rnd_app",
    DATABASE_URL: "postgresql://dmh_rnd_app:" + secret + "@" + expectedHost + ":5432/dmh_rnd?sslmode=require",
    ...overrides,
  };
}

function loadRoute(
  env: Record<string, string>,
  identity: { database_name: string; role_name: string } | null = {
    database_name: "dmh_rnd",
    role_name: "dmh_rnd_app",
  },
  queryError?: Error,
) {
  const calls = { queryCount: 0 };
  const modules: Record<string, unknown> = {
    "next/server": {
      NextResponse: {
        json: (body: unknown, init?: ResponseInit) =>
          new Response(JSON.stringify(body), {
            status: init?.status ?? 200,
            headers: {
              "content-type": "application/json",
              ...(init?.headers ?? {}),
            },
          }),
      },
    },
    "@/lib/prisma": {
      prisma: {
        $queryRaw: async () => {
          calls.queryCount += 1;
          if (queryError) throw queryError;
          return identity ? [identity] : [];
        },
      },
    },
    "@/lib/rnd/worker-auth": {
      requireRndWorker: (authorization: string | null) =>
        authorization === "Bearer fixture"
          ? null
          : new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
    },
  };

  const source = readFileSync("app/api/rnd/worker/identity/route.ts", "utf8");
  const code = transformSync(source, { loader: "ts", format: "cjs", platform: "node" }).code;
  const mockRequire = (name: string) => {
    assert.ok(Object.hasOwn(modules, name), "Unexpected identity-route dependency: " + name);
    return modules[name];
  };
  const mod = { exports: {} as Record<string, unknown> };
  new Function("require", "module", "exports", "process", code)(
    mockRequire,
    mod,
    mod.exports,
    { env },
  );

  return {
    POST: (mod.exports as { POST: (request: Request) => Promise<Response> }).POST,
    calls,
  };
}

function request(authorized = true) {
  return new Request("https://fixture.invalid/api/rnd/worker/identity", {
    method: "POST",
    headers: authorized ? { authorization: "Bearer fixture" } : {},
  });
}

async function body(response: Response) {
  return await response.json() as Record<string, unknown>;
}

async function main() {
  const unauthorized = loadRoute(previewEnv());
  assert.equal((await unauthorized.POST(request(false))).status, 401);
  assert.equal(unauthorized.calls.queryCount, 0, "unauthorized requests must not query Prisma");

  for (const [name, overrides] of [
    ["production", { VERCEL_ENV: "production" }],
    ["wrong branch", { VERCEL_GIT_COMMIT_REF: "main" }],
    ["wrong project URL", { VERCEL_URL: "another-project-fixture.vercel.app" }],
    ["wrong Neon project", { RND_DATABASE_EXPECTED_PROJECT_ID: "wrong-project" }],
    ["wrong Neon branch", { RND_DATABASE_EXPECTED_BRANCH_ID: "wrong-branch" }],
  ] as Array<[string, Record<string, string>]>) {
    const blocked = loadRoute(previewEnv(overrides));
    const response = await blocked.POST(request());
    assert.equal(response.status, 404, name + " must be hidden");
    assert.equal(blocked.calls.queryCount, 0, name + " must not query Prisma");
  }

  const wrongUrl = loadRoute(previewEnv({
    DATABASE_URL: "postgresql://dmh_rnd_app:" + secret + "@wrong-host.neon.tech:5432/dmh_rnd?sslmode=require",
  }));
  const wrongUrlResponse = await wrongUrl.POST(request());
  assert.equal(wrongUrlResponse.status, 503);
  assert.equal((await body(wrongUrlResponse)).code, "RND_PREVIEW_DATABASE_CONFIGURATION_MISMATCH");
  assert.equal(wrongUrl.calls.queryCount, 0, "a mismatched URL must be rejected before connecting");

  const wrongDatabase = loadRoute(previewEnv(), { database_name: "neondb", role_name: "neondb_owner" });
  const wrongDatabaseResponse = await wrongDatabase.POST(request());
  assert.equal(wrongDatabaseResponse.status, 503);
  const wrongDatabaseBody = await body(wrongDatabaseResponse);
  assert.deepEqual(wrongDatabaseBody, { code: "RND_PREVIEW_DATABASE_IDENTITY_MISMATCH" });
  assert.equal(wrongDatabase.calls.queryCount, 1);
  assert.ok(!JSON.stringify(wrongDatabaseBody).includes("neondb"));
  assert.ok(!JSON.stringify(wrongDatabaseBody).includes("neondb_owner"));

  const failedQuery = loadRoute(previewEnv(), null, new Error("database password leaked in this fixture"));
  const failedResponse = await failedQuery.POST(request());
  assert.equal(failedResponse.status, 503);
  const failedBody = await body(failedResponse);
  assert.deepEqual(failedBody, { code: "RND_PREVIEW_DATABASE_IDENTITY_QUERY_FAILED" });
  assert.ok(!JSON.stringify(failedBody).includes("password"));

  const success = loadRoute(previewEnv());
  const response = await success.POST(request());
  assert.equal(response.status, 200);
  const result = await body(response);
  assert.deepEqual(result, {
    ok: true,
    currentDatabase: "dmh_rnd",
    currentUser: "dmh_rnd_app",
    endpointHost: expectedHost,
    port: "5432",
  });
  assert.equal(success.calls.queryCount, 1);
  assert.ok(!JSON.stringify(result).includes(secret));
  assert.ok(!("DATABASE_URL" in result));
  assert.ok(!("password" in result));
  assert.equal(response.headers.get("cache-control"), "no-store, max-age=0");

  console.log("PASS Preview-only runtime database identity route: auth, branch/project guards, URL fence, actual Prisma identity, no-store, and secret-free responses.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
