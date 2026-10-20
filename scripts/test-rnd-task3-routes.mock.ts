/**
 * Deterministic handler-level regression tests. Uses real route handlers with
 * mocked Prisma/auth/Blob, and NEVER connects to a database or real storage.
 * Live Preview/isolated-database verification remains separately required.
 */
import assert from "node:assert/strict";
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

async function testArtifact(routePath: string, fileKey: string) {
  const now = Date.now();
  const startedAt = new Date(now - 1000);
  const job = { id: "fixture-job", status: "PROCESSING", leaseOwner: "worker-a",
    startedAt, attemptCount: 0, leaseExpiresAt: new Date(now + 120000) };
  let putCalls = 0, delCalls = 0, createdAssets = 0, fenced = false, reservationArtifact: string | null = null;
  const prisma = {
    rnDJob: { findUnique: async () => job },
    rnDAttempt: { findUnique: async () => ({ id: "reservation-1", artifactId: reservationArtifact }) },
    $transaction: async (fn: (tx: any) => Promise<unknown>) => fn({
      rnDAttempt: { findUnique: async () => ({ artifactId: reservationArtifact }),
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
    "@vercel/blob": {
      put: async () => { putCalls++; return { url: "https://blob.invalid/upload-" + putCalls }; },
      del: async () => { delCalls++; },
    },
  });
  const form = (token?: string) => {
    const m = new Map<string, FormDataEntryValue>();
    m.set("jobId", "fixture-job"); m.set("attemptNumber", "1");
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
  assert.equal((await route(current)).status, 409, "changed lease after blob upload must reject DB commit");
  assert.equal(putCalls, 1);
  assert.equal(delCalls, 1, "rejected upload must attempt blob compensation");
  assert.equal(createdAssets, 0, "failed final fence must not create asset");
  assert.equal(reservationArtifact, null);
  fenced = true;
  assert.equal((await route(form(startedAt.toISOString()))).status, 200,
    "current claim with a valid commit fence should succeed");
  assert.equal(createdAssets, 1);
  console.log("PASS handler-mock: " + routePath + " generation, lease, final fence and storage compensation");
}

async function testCleanup() {
  const makeFixture = () => ({
    id: "fixture-campaign", name: "R&D Task 3 approval-fence regression fixture",
    createdByUserId: "task3-regression-fixture",
    targets: [{ id: "fixture-target", targetKey: "task3-approval-fence-fixture-mock",
      sourceAssetId: "source-asset",
      jobs: [{ id: "fixture-job", attempts: [{ id: "fixture-attempt", artifactId: "shared-asset" }] }] }],
  });
  let fixture: ReturnType<typeof makeFixture> | null = makeFixture();
  let assets = [
    { id: "source-asset", blobUrl: "https://blob.invalid/source" },
    { id: "shared-asset", blobUrl: "https://blob.invalid/shared" },
  ];
  let authorized = false;
  let failDelete = false;
  const blobDeletes: string[] = [];
  const externalRefs = new Set(["shared-asset"]);
  const tx = {
    rnDAttempt: {
      deleteMany: async () => ({ count: 1 }),
      count: async ({ where }: any) => externalRefs.has(where.artifactId) ? 1 : 0,
    },
    rnDJob: { deleteMany: async () => ({ count: 1 }) },
    rnDTarget: {
      deleteMany: async () => {
        if (failDelete) throw new Error("forced cleanup rollback");
        return { count: 1 };
      },
      count: async ({ where }: any) => externalRefs.has(where.sourceAssetId) ? 1 : 0,
    },
    rnDCampaign: { delete: async () => { fixture = null; } },
    rnDAsset: { delete: async ({ where }: any) => {
      assets = assets.filter((a) => a.id !== where.id);
    } },
  };
  const prisma = {
    rnDCampaign: { findUnique: async () => structuredClone(fixture) },
    rnDAsset: { findMany: async ({ where }: any) =>
      assets.filter(a => where.id.in.includes(a.id)) },
    $transaction: async <T>(fn: (arg: any) => Promise<T>) => {
      const snapshot = structuredClone({ fixture, assets });
      try { return await fn(tx); } catch (e) {
        fixture = snapshot.fixture; assets = snapshot.assets; throw e;
      }
    },
  };
  const cleanup = await handler("app/api/rnd/worker/test-cleanup/route.ts", {
    "@/lib/prisma": { prisma },
    "@/lib/rnd/worker-auth": { requireRndWorker: () =>
      authorized ? null : Response.json({ error: "Unauthorized" }, { status: 401 }) },
    "@vercel/blob": { del: async (url: string) => { blobDeletes.push(url); } },
  });
  const req = () => request("worker/test-cleanup", { campaignId: "fixture-campaign" });
  assert.equal((await cleanup(req())).status, 401, "unauthorized fixture cleanup must reject");
  authorized = true;
  if (!fixture) throw new Error("Missing fixture");
  fixture.createdByUserId = "not-fixture";
  assert.equal((await cleanup(req())).status, 409, "unowned campaign must reject");
  assert.equal(blobDeletes.length, 0);
  fixture.createdByUserId = "task3-regression-fixture";
  failDelete = true;
  await assert.rejects(() => cleanup(req()), /forced cleanup rollback/);
  assert.equal(assets.length, 2, "failed cleanup transaction must preserve assets");
  assert.ok(fixture, "failed cleanup transaction must preserve campaign");
  assert.equal(blobDeletes.length, 0, "failed database transaction must not delete blobs");

  failDelete = false;
  assert.equal((await cleanup(req())).status, 200);
  assert.equal(fixture, null, "owned fixture campaign must be deleted");
  assert.deepEqual(assets.map(a => a.id), ["shared-asset"],
    "referenced asset must remain after fixture cleanup");
  assert.deepEqual(blobDeletes, ["https://blob.invalid/source"],
    "blob deletion must exclude asset still referenced by other records");
  const again = await cleanup(req());
  assert.equal(again.status, 200);
  assert.equal((await body(again)).deleted, false, "repeat cleanup must be idempotent");
  assert.equal(blobDeletes.length, 1);
  console.log("PASS handler-mock: authenticated fixture cleanup, ownership, transaction rollback and shared asset preservation");
}

async function main() {
  await testApproval();
  await testReport();
  await testArtifact("app/api/rnd/worker/artifacts/route.ts", "file");
  await testArtifact("app/api/rnd/agent/artifact/route.ts", "image");
  await testCleanup();
  console.log("All Task 3 handler mock regressions passed. NO database or Blob storage contacted.");
}
void main().catch((error) => { console.error(error); process.exitCode = 1; });
