import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { transformSync } from "esbuild";
import {
  resolveRndWorkerClaimJobId,
  RND_WORKER_ISOLATED_JOB_ID_HEADER,
} from "../lib/rnd/worker-claim-policy.js";

const now = new Date("2026-11-19T10:00:00.000Z");
const fixedDate = new Proxy(Date, {
  construct: (target, args) => Reflect.construct(target, args.length ? args : [now.getTime()]),
});

type Fixture = {
  queuedCandidate?: Record<string, unknown> | null;
  processingCandidate?: Record<string, unknown> | null;
  reservation?: Record<string, unknown> | null;
};

function candidate(id = "fresh-test-job-1") {
  return {
    id,
    targetId: "target-1",
    attemptCount: 0,
    currentPrompt: "fixture prompt",
    status: "QUEUED",
    startedAt: null,
    maxGenerationAttempts: 4,
    infrastructureRetryCount: 0,
  };
}

function claimedJob(id = "fresh-test-job-1") {
  return {
    id,
    targetId: "target-1",
    status: "PROCESSING",
    attemptCount: 0,
    startedAt: now,
    leaseExpiresAt: new Date(now.getTime() + 120_000),
    promptVersionNumber: 1,
    currentPrompt: "fixture prompt",
    target: {
      id: "target-1",
      targetType: "HAIRSTYLE",
      targetKey: "fixture-target",
      hairstyleId: null,
      hairColorKey: null,
      beardKey: null,
      hardCoreInstruction: null,
      sourceAssetId: "source-1",
      sourceAsset: {
        id: "source-1",
        kind: "REFERENCE",
        storageKey: "fixture/source.png",
        blobUrl: "https://fixture.invalid/source.png",
        mimeType: "image/png",
        fileSize: 8,
        width: 1,
        height: 1,
        checksum: "a".repeat(64),
      },
    },
  };
}

function loadClaim(env: Record<string, string>, fixture: Fixture = {}) {
  const calls = {
    transactions: 0,
    globalFindMany: [] as unknown[],
    findFirst: [] as Array<Record<string, any>>,
    jobUpdates: [] as Array<Record<string, any>>,
    attemptFindUnique: [] as unknown[],
    attemptCreates: [] as unknown[],
    targetUpdates: [] as unknown[],
  };
  const tx = {
    $queryRaw: async () => [],
    rnDJob: {
      findMany: async (args: unknown) => {
        calls.globalFindMany.push(args);
        return [];
      },
      findFirst: async (args: { where: Record<string, any> }) => {
        calls.findFirst.push(args.where);
        return args.where.status === "QUEUED"
          ? fixture.queuedCandidate ?? null
          : args.where.status === "PROCESSING"
            ? fixture.processingCandidate ?? null
            : null;
      },
      updateMany: async (args: Record<string, any>) => {
        calls.jobUpdates.push(args);
        return { count: 1 };
      },
      findUnique: async () => claimedJob(String(fixture.queuedCandidate?.id ?? "fresh-test-job-1")),
    },
    rnDAttempt: {
      findUnique: async (args: unknown) => {
        calls.attemptFindUnique.push(args);
        return fixture.reservation ?? null;
      },
      create: async (args: unknown) => {
        calls.attemptCreates.push(args);
        return { id: "fixture-attempt-1" };
      },
    },
    rnDTarget: {
      update: async (args: unknown) => {
        calls.targetUpdates.push(args);
        return {};
      },
    },
  };
  const modules: Record<string, unknown> = {
    "next/server": {
      NextResponse: {
        json: (body: unknown, init?: ResponseInit) =>
          new Response(JSON.stringify(body), {
            status: init?.status ?? 200,
            headers: { "content-type": "application/json" },
          }),
      },
    },
    "node:crypto": { randomUUID: () => "fixture-worker" },
    "@/lib/rnd/retry-policy": {
      configuredGenerationBudget: () => 4,
      generationBudget: (stored: number | null) => stored ?? 4,
    },
    "@/lib/prisma": {
      prisma: {
        $transaction: async (fn: (tx: any) => Promise<unknown>) => {
          calls.transactions += 1;
          return fn(tx);
        },
      },
    },
    "@/lib/rnd/artifact-checksums": { readPriorRndArtifactChecksums: async () => [] },
    "@/lib/rnd/worker-auth": {
      MAX_RND_INFRASTRUCTURE_RETRIES: 3,
      RND_WORKER_LEASE_SECONDS: 120,
      RND_WORKER_PROTOCOL_VERSION: "2",
      requireRndWorker: (authorization: string | null) =>
        authorization === "Bearer fixture" ? null : new Response(null, { status: 401 }),
    },
    "@/lib/rnd/worker-claim-policy": { resolveRndWorkerClaimJobId, RND_WORKER_ISOLATED_JOB_ID_HEADER },
  };
  const source = readFileSync("app/api/rnd/worker/claim/route.ts", "utf8");
  const code = transformSync(source, { loader: "ts", format: "cjs", platform: "node" }).code;
  const mockRequire = (name: string) => {
    assert.ok(Object.hasOwn(modules, name), "Unexpected claim-route dependency: " + name);
    return modules[name];
  };
  const mod = { exports: {} as Record<string, unknown> };
  new Function("require", "module", "exports", "process", "Date", code)(
    mockRequire, mod, mod.exports, { env }, fixedDate,
  );
  return {
    POST: (mod.exports as { POST: (request: Request) => Promise<Response> }).POST,
    calls,
  };
}

function loadHello(env: Record<string, string>) {
  const modules: Record<string, unknown> = {
    "next/server": {
      NextResponse: {
        json: (body: unknown, init?: ResponseInit) =>
          new Response(JSON.stringify(body), {
            status: init?.status ?? 200,
            headers: { "content-type": "application/json" },
          }),
      },
    },
    "@/lib/rnd/worker-auth": {
      RND_WORKER_PROTOCOL_VERSION: "2",
      requireRndWorker: (authorization: string | null) =>
        authorization === "Bearer fixture" ? null : new Response(null, { status: 401 }),
    },
    "@/lib/rnd/worker-claim-policy": {
      resolveRndWorkerClaimJobId,
      RND_WORKER_ISOLATED_JOB_ID_HEADER,
    },
  };
  const source = readFileSync("app/api/rnd/worker/hello/route.ts", "utf8");
  const code = transformSync(source, { loader: "ts", format: "cjs", platform: "node" }).code;
  const mockRequire = (name: string) => {
    assert.ok(Object.hasOwn(modules, name), "Unexpected hello-route dependency: " + name);
    return modules[name];
  };
  const mod = { exports: {} as Record<string, unknown> };
  new Function("require", "module", "exports", "process", "Date", code)(
    mockRequire, mod, mod.exports, { env }, fixedDate,
  );
  return (mod.exports as { GET: (request: Request) => Promise<Response> }).GET;
}

function request(jobId: string | null) {
  const headers = new Headers({
    authorization: "Bearer fixture",
    "x-rnd-worker-protocol": "2",
  });
  if (jobId !== null) headers.set(RND_WORKER_ISOLATED_JOB_ID_HEADER, jobId);
  return new Request("https://fixture.invalid/api/rnd/worker/claim", { method: "POST", headers });
}

function helloRequest(jobId: string | null) {
  const headers = new Headers({ authorization: "Bearer fixture" });
  if (jobId !== null) headers.set(RND_WORKER_ISOLATED_JOB_ID_HEADER, jobId);
  return new Request("https://fixture.invalid/api/rnd/worker/hello", { headers });
}

function assertPolicyError(
  policy: ReturnType<typeof resolveRndWorkerClaimJobId>,
  code: string,
  status: 409 | 503,
) {
  if (policy.ok) throw new Error("Expected claim policy rejection: " + code);
  assert.equal(policy.code, code);
  assert.equal(policy.status, status);
}
async function main() {
  assert.deepEqual(resolveRndWorkerClaimJobId(undefined, null), { ok: true, jobId: null });
  assert.deepEqual(resolveRndWorkerClaimJobId("fresh-test-job-1", "fresh-test-job-1"), {
    ok: true, jobId: "fresh-test-job-1",
  });
  assertPolicyError(resolveRndWorkerClaimJobId(undefined, "fresh-test-job-1"), "RND_WORKER_ISOLATION_NOT_CONFIGURED", 503);
  assertPolicyError(resolveRndWorkerClaimJobId("", "fresh-test-job-1"), "RND_WORKER_ISOLATION_CONFIG_INVALID", 503);
  assertPolicyError(resolveRndWorkerClaimJobId("fresh-test-job-1", null), "RND_WORKER_ISOLATION_JOB_ID_MISMATCH", 409);
  assertPolicyError(resolveRndWorkerClaimJobId("fresh-test-job-1", "other-job"), "RND_WORKER_ISOLATION_JOB_ID_MISMATCH", 409);

  const helloIsolated = loadHello({ RND_WORKER_ISOLATED_JOB_ID: "fresh-test-job-1" });
  assert.equal((await helloIsolated(helloRequest("fresh-test-job-1"))).status, 200);
  assert.equal((await helloIsolated(helloRequest("other-job"))).status, 409);
  const helloNormal = loadHello({});
  assert.equal((await helloNormal(helloRequest(null))).status, 200);

  const unconfigured = loadClaim({}, { queuedCandidate: candidate() });
  const unconfiguredResponse = await unconfigured.POST(request("fresh-test-job-1"));
  assert.equal(unconfiguredResponse.status, 503);
  assert.equal(unconfigured.calls.transactions, 0, "a worker header cannot enable isolation without server configuration");

  const mismatched = loadClaim({ RND_WORKER_ISOLATED_JOB_ID: "fresh-test-job-1" }, { queuedCandidate: candidate() });
  const mismatchResponse = await mismatched.POST(request("other-job"));
  assert.equal(mismatchResponse.status, 409);
  assert.equal(mismatched.calls.transactions, 0, "a mismatched ID must be rejected before opening a transaction");

  const isolated = loadClaim(
    { RND_WORKER_ISOLATED_JOB_ID: "fresh-test-job-1" },
    {
      queuedCandidate: candidate(),
      processingCandidate: { id: "historical-expired-job", status: "PROCESSING" },
    },
  );
  const isolatedResponse = await isolated.POST(request("fresh-test-job-1"));
  assert.equal(isolatedResponse.status, 200);
  const isolatedBody = await isolatedResponse.json() as { job: { id: string } | null };
  assert.equal(isolatedBody.job?.id, "fresh-test-job-1");
  assert.equal(isolated.calls.globalFindMany.length, 0, "isolated mode must skip the global over-limit sweep");
  assert.equal(isolated.calls.findFirst.length, 1, "isolated mode must issue only the QUEUED candidate query");
  assert.equal(isolated.calls.findFirst[0].id, "fresh-test-job-1");
  assert.equal(isolated.calls.findFirst[0].status, "QUEUED");
  assert.equal(isolated.calls.findFirst[0].attemptCount, 0);
  assert.equal(isolated.calls.findFirst[0].infrastructureRetryCount, 0);
  assert.equal(isolated.calls.jobUpdates.length, 1);
  assert.equal(isolated.calls.jobUpdates[0].where.status, "QUEUED");
  assert.equal(isolated.calls.attemptFindUnique.length, 1, "the first-attempt reservation is checked before claim");
  assert.equal(isolated.calls.attemptCreates.length, 1);
  assert.equal(isolated.calls.targetUpdates.length, 1);
  assert.ok(
    !JSON.stringify(isolated.calls.jobUpdates[0].where).includes("PROCESSING"),
    "isolated update predicate must not allow expired PROCESSING recovery",
  );

  const expiredOnly = loadClaim(
    { RND_WORKER_ISOLATED_JOB_ID: "fresh-test-job-1" },
    { queuedCandidate: null, processingCandidate: { id: "historical-expired-job", status: "PROCESSING" } },
  );
  const expiredResponse = await expiredOnly.POST(request("fresh-test-job-1"));
  assert.equal(expiredResponse.status, 200);
  assert.deepEqual(await expiredResponse.json(), { ok: true, job: null });
  assert.deepEqual(expiredOnly.calls.findFirst.map(where => where.status), ["QUEUED"]);
  assert.equal(expiredOnly.calls.globalFindMany.length, 0);
  assert.equal(expiredOnly.calls.jobUpdates.length, 0);
  assert.equal(expiredOnly.calls.targetUpdates.length, 0);

  const reserved = loadClaim(
    { RND_WORKER_ISOLATED_JOB_ID: "fresh-test-job-1" },
    { queuedCandidate: candidate(), reservation: { id: "existing-attempt-reservation" } },
  );
  const reservedResponse = await reserved.POST(request("fresh-test-job-1"));
  assert.equal(reservedResponse.status, 200);
  assert.deepEqual(await reservedResponse.json(), { ok: true, job: null });
  assert.equal(reserved.calls.jobUpdates.length, 0, "a job with a pre-existing attempt reservation is not fresh");
  assert.equal(reserved.calls.targetUpdates.length, 0);

  const normal = loadClaim({}, { queuedCandidate: null, processingCandidate: null });
  const normalResponse = await normal.POST(request(null));
  assert.equal(normalResponse.status, 200);
  assert.deepEqual(await normalResponse.json(), { ok: true, job: null });
  assert.equal(normal.calls.globalFindMany.length, 1, "normal mode retains its existing global sweep");
  assert.deepEqual(normal.calls.findFirst.map(where => where.status), ["QUEUED", "PROCESSING"]);

  const worker = readFileSync("tools/rnd-worker/worker.ts", "utf8");
  const configStart = worker.indexOf("const RUN_ONCE =");
  const configEnd = worker.indexOf("const WORKER_VERSION =", configStart);
  assert.ok(configStart >= 0 && configEnd > configStart, "worker isolation config block must remain present");
  const configCode = transformSync(worker.slice(configStart, configEnd), { loader: "ts" }).code;
  const validateWorkerConfig = new Function("process", configCode + "\nreturn { RUN_ONCE, ISOLATED_JOB_ID };") as
    (process: { env: Record<string, string> }) => { RUN_ONCE: boolean; ISOLATED_JOB_ID: string | null };
  assert.throws(
    () => validateWorkerConfig({ env: { RND_WORKER_ONCE: "1" } }),
    /RND_WORKER_ISOLATED_JOB_ID is required/,
    "one-shot mode must fail before browser launch without an explicit job ID",
  );
  assert.throws(
    () => validateWorkerConfig({ env: { RND_WORKER_ISOLATED_JOB_ID: "fresh-test-job-1" } }),
    /may only be used with RND_WORKER_ONCE=1/,
    "isolated mode must not run as an unrestricted polling worker",
  );
  assert.deepEqual(
    validateWorkerConfig({ env: { RND_WORKER_ONCE: "1", RND_WORKER_ISOLATED_JOB_ID: "fresh-test-job-1" } }),
    { RUN_ONCE: true, ISOLATED_JOB_ID: "fresh-test-job-1" },
  );
  assert.deepEqual(validateWorkerConfig({ env: {} }), { RUN_ONCE: false, ISOLATED_JOB_ID: null });
  assert.ok(worker.includes("RND_WORKER_ISOLATED_JOB_ID"), "worker must require the isolated job ID in one-shot mode");
  assert.ok(worker.includes("refusing an unrestricted one-shot claim"), "one-shot mode must fail closed without an ID");
  assert.ok(worker.includes('"x-rnd-worker-job-id"'), "worker must send the exact job ID header");
  assert.ok(worker.includes("result.job.id !== ISOLATED_JOB_ID"), "worker must reject any unexpected returned job");
  assert.ok(worker.includes('api("/api/rnd/worker/hello", { headers })'), "worker must verify isolation before launching Chrome");

  console.log("PASS R&D worker claim isolation: exact allowlist, fresh QUEUED-only claim, no global sweep/recovery, and unchanged normal mode.");
}

void main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});