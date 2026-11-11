import * as retryPolicy from "../lib/rnd/retry-policy";
/**
 * Deterministic handler-level regression tests. Uses real route handlers with
 * mocked Prisma/auth/Blob, and NEVER connects to a database or real storage.
 * Live Preview/isolated-database verification remains separately required.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readPriorRndArtifactChecksums } from "../lib/rnd/artifact-checksums";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { transform } from "esbuild";

const nativeRequire = createRequire(import.meta.url);
const next = { NextResponse: { json: (body: unknown, init?: { status?: number }) =>
  Response.json(body, { status: init?.status ?? 200 }) } };

type Route = (request: Request) => Promise<Response>;
async function handler(filename: string, modules: Record<string, unknown>): Promise<Route> {
  const code = (await transform(readFileSync(filename, "utf8"), {
    loader: "ts", format: "cjs", platform: "node", target: "node20",
  })).code;
  const mod: { exports: Record<string, unknown> } = { exports: {} };
  const mockRequire = (name: string) => {
    if (Object.prototype.hasOwnProperty.call(modules, name)) return modules[name];
    if (name === "next/server") return next;
    if (name === "@/lib/rnd/retry-policy") return retryPolicy;
    if (name === "@/lib/rnd/artifact-checksums") return { readPriorRndArtifactChecksums };
    if (name.startsWith("@/")) return {};
    return nativeRequire(name);
  };
  new Function("require", "module", "exports", code)(mockRequire, mod, mod.exports);
  return mod.exports.POST as Route;
}

const request = (path: string, body: unknown) => new Request("https://fixture.invalid/" + path, {
  method: "POST", headers: { "content-type": "application/json", authorization: "Bearer fixture",
    "x-rnd-worker-id": "worker-a" }, body: JSON.stringify(body),
});
const body = async (response: Response) => response.json() as Promise<Record<string, unknown>>;

type State = {
  job: { id: string; targetId: string; status: string; target: { hairstyleId: string | null; targetKey: string };
    completedAt?: Date | null; failureCode?: string | null; failureMessage?: string | null };
  target: { status: string };
  attempts: Array<{ id: string; jobId: string; attemptNumber: number; prompt: string; verdict: string;
    overallScore: string | null; artifactId: string | null; aiGatePassed: boolean; publicationTierPassed: boolean }>;
  prompts: Array<{ sourceRnDAttemptId: string; status: string; qaStatus: string; version: number }>;
};
function initialState(): State {
  return {
    job: { id: "fixture-job", targetId: "fixture-target", status: "HUMAN_APPROVAL",
      target: { hairstyleId: null, targetKey: "task3-approval-fence-fixture-mock" } },
    target: { status: "HUMAN_APPROVAL" },
    attempts: [{ id: "attempt-1", jobId: "fixture-job", attemptNumber: 1,
      prompt: "Test hair-only prompt", verdict: "HUMAN_APPROVAL", overallScore: "9.50",
      artifactId: "fixture-asset", aiGatePassed: true, publicationTierPassed: true }],
    prompts: [],
  };
}

async function testApproval() {
  let state = initialState();
  let session: unknown = { user: { id: "test-admin", role: "ADMIN" } };
  let forceCasConflict = false;
  let failTargetUpdate = false;
  let writeCount = 0;
  const prisma = {
    $transaction: async <T>(fn: (tx: any) => Promise<T>) => {
      const snapshot = structuredClone(state);
      try { return await fn(tx); } catch (error) { state = snapshot; throw error; }
    },
  };
  const tx = {
    rnDJob: {
      findUnique: async ({ where }: any) => where.id !== state.job.id ? null :
        { ...structuredClone(state.job), attempts: structuredClone(state.attempts.filter(a => a.verdict === "HUMAN_APPROVAL")) },
      updateMany: async ({ where, data }: any) => {
        if (forceCasConflict || where.id !== state.job.id || state.job.status !== where.status) return { count: 0 };
        Object.assign(state.job, data); writeCount++; return { count: 1 };
      },
    },
    rnDTarget: {
      update: async ({ data }: any) => {
        if (failTargetUpdate) throw new Error("forced transaction rollback");
        Object.assign(state.target, data); writeCount++;
      },
    },
    rnDAttempt: {
      updateMany: async ({ where, data }: any) => {
        for (const attempt of state.attempts) {
          if (attempt.jobId === where.jobId && attempt.verdict === where.verdict) {
            Object.assign(attempt, data); writeCount++;
          }
        }
      },
    },
    promptVersion: {
      findUnique: async () => null,
      findFirst: async () => null,
      create: async ({ data }: any) => { state.prompts.push(data); writeCount++; return data; },
    },
  };
  Object.assign(prisma, { $transaction: async <T>(fn: (tx: any) => Promise<T>) => {
    const snapshot = structuredClone(state);
    try { return await fn(tx); } catch (error) { state = snapshot; throw error; }
  } });
  const modules = { "@/auth": { auth: async () => session }, "@/lib/prisma": { prisma } };
  const approve = await handler("app/api/rnd/approval/approve/route.ts", modules);
  const reject = await handler("app/api/rnd/approval/reject/route.ts", modules);
  const reqApprove = () => request("approval/approve", { jobId: state.job.id });
  const reqReject = () => request("approval/reject", { jobId: state.job.id, reason: "Fixture rejection" });

  session = null;
  assert.equal((await approve(reqApprove())).status, 401);
  assert.equal((await reject(reqReject())).status, 401);
  assert.equal(writeCount, 0);
  session = { user: { id: "staff", role: "USER" } };
  assert.equal((await approve(reqApprove())).status, 401);
  session = { user: { id: "test-admin", role: "ADMIN" } };
  assert.equal((await approve(request("approval/approve", {}))).status, 400);
  assert.equal((await reject(request("approval/reject", { jobId: "missing" }))).status, 404);

  for (const change of [
    (s: State) => { s.attempts = []; },
    (s: State) => { s.attempts[0].artifactId = null; },
    (s: State) => { s.attempts[0].overallScore = "9.49"; },
    (s: State) => { s.attempts[0].aiGatePassed = false; },
    (s: State) => { s.attempts[0].publicationTierPassed = false; },
  ]) {
    state = initialState(); change(state);
    assert.equal((await approve(reqApprove())).status, 409, "invalid QA eligibility must block approval");
    assert.equal(state.job.status, "HUMAN_APPROVAL");
    assert.equal(state.target.status, "HUMAN_APPROVAL");
    assert.equal(state.prompts.length, 0);
  }

  state = initialState(); forceCasConflict = true;
  assert.equal((await approve(reqApprove())).status, 409, "CAS loser must not approve");
  assert.equal((await reject(reqReject())).status, 409, "CAS loser must not reject");
  assert.equal(state.target.status, "HUMAN_APPROVAL");
  forceCasConflict = false;

  state = initialState(); failTargetUpdate = true;
  await assert.rejects(() => approve(reqApprove()), /forced transaction rollback/);
  assert.equal(state.job.status, "HUMAN_APPROVAL", "transaction rollback must restore job");
  assert.equal(state.target.status, "HUMAN_APPROVAL", "transaction rollback must restore target");
  failTargetUpdate = false;

  state = initialState();
  assert.equal((await approve(reqApprove())).status, 200);
  assert.equal(state.job.status, "COMPLETED");
  assert.equal(state.target.status, "APPROVED");
  assert.equal(state.attempts[0].verdict, "APPROVED");
  assert.equal((await approve(reqApprove())).status, 409, "repeat approve must conflict");
  assert.equal((await reject(reqReject())).status, 409, "reject after approval must conflict");
  assert.equal(state.prompts.length, 0, "fixture must not import a production hairstyle prompt");

  state = initialState();
  assert.equal((await reject(reqReject())).status, 200);
  assert.equal(state.job.status, "FAILED");
  assert.equal(state.job.failureCode, "HUMAN_REJECTED");
  assert.equal(state.target.status, "REJECTED");
  assert.equal(state.attempts[0].verdict, "FAILED");
  assert.equal((await reject(reqReject())).status, 409, "repeat reject must conflict");
  assert.equal((await approve(reqApprove())).status, 409, "approve after rejection must conflict");
  console.log("PASS handler-mock: authenticated approval/rejection, gate rejection, CAS conflicts, repeat requests and rollback");
}

async function testReport() {
  let job = { id: "fixture-job", status: "FAILED", leaseOwner: null as string | null,
    leaseExpiresAt: null as Date | null,
    startedAt: new Date("2026-10-15T10:00:00.000Z"), attemptCount: 1,
    targetId: "target", target: { targetKey: "task3-approval-fence-fixture-test",
      hairstyleId: null, sourceAsset: { blobUrl: "unused", mimeType: "image/png" } } };
  let txCount = 0;
  const prisma = {
    rnDJob: { findUnique: async () => job },
    $transaction: async () => { txCount++; throw new Error("No transaction allowed"); },
  };
  const generation = job.startedAt.toISOString();
  const route = await handler("app/api/rnd/worker/report/route.ts", {
    "@/lib/prisma": { prisma },
    "@/lib/rnd/worker-auth": { requireRndWorker: () => null },
    "@/lib/rnd/blob-storage": { requireRndBlobToken: () => "fixture-token" },
    "@/lib/rnd/report-lease-fence": {
      validateRndClaimGeneration: (submitted: unknown, current: Date) =>
        typeof submitted !== "string" || Number.isNaN(new Date(submitted).getTime()) ? { status: "invalid" } :
          submitted !== current.toISOString() ? { status: "stale" } :
            { status: "valid", generation: current },
      hasValidRndLeaseExpiry: (expires: unknown, now: Date) => expires instanceof Date && expires > now,
    },
  });
  assert.equal((await route(request("report", { jobId: job.id, attemptNumber: 2,
    claimGeneration: generation, requeueFailed: true }))).status, 409,
    "worker token must not requeue FAILED jobs, even with a known claim token");
  assert.equal(job.status, "FAILED");
  assert.equal(txCount, 0, "requeue bypass must not reach a transaction");

  assert.equal((await route(request("report", { jobId: job.id, attemptNumber: 2,
    claimGeneration: "invalid" }))).status, 400);
  assert.equal((await route(request("report", { jobId: job.id, attemptNumber: 2,
    claimGeneration: "2026-10-15T10:00:01.000Z" }))).status, 409);

  job = { ...job, status: "PROCESSING", leaseOwner: "worker-a",
    leaseExpiresAt: new Date("2020-01-01T00:00:00.000Z") };
  assert.equal((await route(request("report", { jobId: job.id, attemptNumber: 2,
    claimGeneration: generation }))).status, 409, "expired lease must fail closed before QA");
  assert.equal(txCount, 0);
  console.log("PASS handler-mock: invalid/stale report generation, expired leases and failed-job requeue bypass");
}

async function testClaimArtifactHistory() {
  const checksum = "a".repeat(64);
  const job = { id: "fixture-job", targetId: "target", status: "QUEUED", attemptCount: 1,
    currentPrompt: "fixture", startedAt: new Date(0), leaseExpiresAt: new Date(Date.now() + 120000),
    target: { sourceAsset: {} } };
  let prior: Array<{ artifact: { checksum: string | null } }> = [{ artifact: { checksum: checksum.toUpperCase() } }];
  const tx = {
    $queryRaw: async () => [],
    rnDJob: { findMany: async () => [], findFirst: async () => job, updateMany: async () => ({ count: 1 }),
      findUnique: async () => job },
    rnDAttempt: {
      findUnique: async () => null,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        assert.equal(data.submittedAt, null);
        assert.equal(data.promptRevision, "reserved-v2");
      },
      findMany: async ({ where }: { where: object }) => {
        assert.deepEqual(where, { jobId: job.id, attemptNumber: { lt: 2 }, artifact: { is: { kind: "GENERATED" } } });
        return prior;
      },
    },
    rnDTarget: { update: async () => null },
  };
  const claim = await handler("app/api/rnd/worker/claim/route.ts", {
    "@/lib/prisma": { prisma: { $transaction: (fn: (value: typeof tx) => unknown) => fn(tx) } },
    "@/lib/rnd/worker-auth": { requireRndWorker: () => null, RND_WORKER_LEASE_SECONDS: 120,
      MAX_RND_INFRASTRUCTURE_RETRIES: 3, RND_WORKER_PROTOCOL_VERSION: "2" },
  });
  const run = async () => {
    const req = request("claim", {});
    req.headers.set("x-rnd-worker-protocol", "2");
    const result = await claim(req);
    assert.equal(result.status, 200);
    return (await body(result)).job as { priorArtifactChecksums: string[] | null };
  };
  assert.deepEqual((await run()).priorArtifactChecksums, [checksum]);
  prior = [];
  assert.deepEqual((await run()).priorArtifactChecksums, []);
  prior = [{ artifact: { checksum: null } }];
  assert.equal((await run()).priorArtifactChecksums, null);
  console.log("PASS handler-mock: claim returns scoped prior checksums and signals unverifiable history");
}

async function testWorkerArtifact(routePath: string, fileKey: string) {
  const now = Date.now();
  const startedAt = new Date(now - 1000);
  const job = { id: "fixture-job", status: "PROCESSING", leaseOwner: "worker-a",
    startedAt, attemptCount: 0, leaseExpiresAt: new Date(now + 120000) };
  let putCalls = 0, delCalls = 0, createdAssets = 0, fenced = false, reservationArtifact: string | null = null;
  let submission = "RND_SUBMISSION_UNCERTAIN";
  let prior: Array<{ artifact: { checksum: string | null } }> = [];
  let commitPrior = prior;
  const checksum = createHash("sha256").update(new Uint8Array([137, 80, 78, 71])).digest("hex");
  job.attemptCount = 1;
  const readPrior = ({ where }: { where: unknown }) => {
    assert.deepEqual(where, { jobId: job.id, attemptNumber: { lt: 2 }, artifact: { is: { kind: "GENERATED" } } });
  };
  const prisma = {
    rnDJob: { findUnique: async () => job },
    rnDAttempt: { findUnique: async () => ({ id: "reservation-1", errorCode: submission }),
      findMany: async (query: { where: unknown }) => { readPrior(query); return prior; } },
    $transaction: async (fn: (tx: any) => Promise<unknown>) => fn({
      rnDAttempt: { findUnique: async () => ({ errorCode: submission, artifact: reservationArtifact ? { id: reservationArtifact, checksum } : null }),
        findMany: async (query: { where: unknown }) => { readPrior(query); return commitPrior; },
        update: async ({ data }: any) => { reservationArtifact = data.artifactId; } },
      rnDAsset: { create: async () => { createdAssets++; return {
        id: "mock-asset-" + createdAssets, blobUrl: "https://blob.invalid/asset",
        storageKey: "rnd/generated/fixture", fileSize: 4, checksum: "mock",
      }; } },
    }),
  };
  const route = await handler(routePath, {
    "@/lib/prisma": { prisma },
    "@/lib/rnd/worker-auth": { requireRndWorker: () => null },
    "@/lib/rnd/report-lease-fence": {
      parseRndClaimGeneration: (v: unknown) => typeof v === "string" && !Number.isNaN(Date.parse(v))
        && new Date(v).toISOString() === v ? new Date(v) : null,
      hasValidRndLeaseExpiry: (v: unknown, at: Date) => v instanceof Date && v > at,
      fenceRndReportLease: async () => fenced,
    },
    "@/lib/rnd/blob-storage": { requireRndBlobToken: () => "synthetic-rnd-write" },
    "@vercel/blob": {
      put: async (_key: string, _bytes: Buffer, options: { token: string }) => {
        assert.equal(options.token, "synthetic-rnd-write");
        putCalls++; return { url: "https://blob.invalid/upload-" + putCalls };
      },
      del: async () => { delCalls++; },
    },
  });
  const form = (token?: string) => {
    const m = new Map<string, FormDataEntryValue>();
    m.set("jobId", "fixture-job"); m.set("attemptNumber", "2");
    if (token) m.set("claimGeneration", token);
    m.set(fileKey, new File([new Uint8Array([137,80,78,71])], "test.png", { type: "image/png" }));
    return { headers: new Headers({ authorization: "Bearer fixture", "x-rnd-worker-id": "worker-a" }),
      formData: async () => m } as unknown as Request;
  };
  assert.equal((await route(form())).status, 400, "missing generation must reject");
  assert.equal((await route(form("bad-token"))).status, 400, "invalid generation must reject");
  assert.equal((await route(form(new Date(startedAt.getTime() - 1).toISOString()))).status, 409,
    "stale same-worker generation must reject");
  assert.equal(putCalls, 0, "invalid claim must not upload bytes");
  assert.equal(createdAssets, 0);

  const current = form(startedAt.toISOString());
  assert.equal((await route(current)).status, 409);
  assert.equal(putCalls, 0, "no upload before submission is recorded");
  submission = "RND_SUBMITTED";
  prior = [{ artifact: { checksum: checksum.toUpperCase() } }];
  const duplicate = await route(current);
  assert.equal(duplicate.status, 409);
  assert.equal((await body(duplicate)).code, "RND_DUPLICATE_ARTIFACT");
  prior = [{ artifact: { checksum: null } }];
  assert.equal((await body(await route(current))).code, "RND_PRIOR_ARTIFACT_CHECKSUM_UNAVAILABLE");
  assert.equal(putCalls, 0, "duplicate or unverifiable history must stop before Blob put");
  assert.equal(createdAssets, 0);
  prior = [];
  assert.equal((await route(current)).status, 409, "changed lease after blob upload must reject DB commit");
  assert.equal(putCalls, 1);
  assert.equal(delCalls, 1, "rejected upload must attempt blob compensation");
  assert.equal(createdAssets, 0, "failed final fence must not create asset");
  assert.equal(reservationArtifact, null);
  fenced = true;
  commitPrior = [{ artifact: { checksum } }];
  assert.equal((await body(await route(current))).code, "RND_DUPLICATE_ARTIFACT");
  assert.equal(delCalls, 2, "a duplicate discovered under the final fence is compensated");
  assert.equal(createdAssets, 0);
  commitPrior = [];
  assert.equal((await route(form(startedAt.toISOString()))).status, 200,
    "current claim with a valid commit fence should succeed");
  assert.equal(createdAssets, 1);
  assert.equal((await body(await route(form(startedAt.toISOString())))).idempotent, true);
  assert.equal(createdAssets, 1);
  console.log("PASS handler-mock: " + routePath + " generation, lease, duplicate prevention, final fence and storage compensation");
}

async function testArtifact(routePath: string, fileKey: string) {
  const now = Date.now();
  const startedAt = new Date(now - 1000);
  for (const [filename, code, replacement] of [
    ["app/api/rnd/agent/claim/route.ts", "RND_LEGACY_AGENT_CLAIM_DISABLED", "/api/rnd/worker/claim"],
    [routePath, "RND_LEGACY_AGENT_ARTIFACT_DISABLED", "/api/rnd/worker/artifacts"],
  ]) {
    const unexpectedDependency = new Proxy({}, {
      get: () => assert.fail("Disabled agent routes must not use Prisma or Blob storage"),
    });
    const route = await handler(filename, {
      "@/lib/prisma": unexpectedDependency,
      "@vercel/blob": unexpectedDependency,
      "@/lib/rnd/worker-auth": {
        requireRndWorker: (authorization: string | null) =>
          authorization === "Bearer fixture" ? null : new Response(null, { status: 401 }),
      },
    });
    const run = (authorization?: string, protocol?: string) => {
      const headers = new Headers({ "x-rnd-worker-id": "worker-a" });
      if (authorization) headers.set("authorization", authorization);
      if (protocol) headers.set("x-rnd-worker-protocol", protocol);
      const form = new FormData();
      form.set("jobId", "fixture-job");
      form.set("attemptNumber", "1");
      form.set("claimGeneration", startedAt.toISOString());
      form.set(fileKey, new File([new Uint8Array([137, 80, 78, 71])], "test.png", { type: "image/png" }));
      const req = new Request("https://fixture.invalid", {
        method: "POST", headers, body: filename === routePath ? form : "{}",
      });
      const unexpectedBodyRead = () => assert.fail("Disabled agent routes must not read the request body");
      req.json = unexpectedBodyRead;
      req.formData = unexpectedBodyRead;
      return route(req);
    };
    assert.equal((await run()).status, 401);
    assert.equal((await run("Bearer wrong")).status, 401);
    for (const protocol of [undefined, "1", "2"]) {
      const result = await run("Bearer fixture", protocol);
      assert.equal(result.status, 410);
      assert.deepEqual(await body(result), { code, replacement });
    }
  }
  console.log("PASS handler-mock: legacy agent claim and artifact reject all authenticated protocol versions without side effects");
}

async function main() {
  await testApproval();
  await testReport();
  await testClaimArtifactHistory();
  await testWorkerArtifact("app/api/rnd/worker/artifacts/route.ts", "file");
  await testWorkerArtifact("app/api/rnd/worker/artifacts/route.ts", "image");
  await testArtifact("app/api/rnd/agent/artifact/route.ts", "image");
  console.log("All Task 3 handler mock regressions passed. NO database or Blob storage contacted.");
}
void main().catch((error) => { console.error(error); process.exitCode = 1; });
