/** Actual calibration decision code and route handlers; all I/O is mocked. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { transformSync } from "esbuild";
import { CALIBRATION_POLICY_VERSION, computeCalibration, hasVerifiedCalibration } from "../lib/rnd/calibration-evidence";

const req = createRequire(import.meta.url), sha = (v: string) => createHash("sha256").update(v).digest("hex");
const candidate = { id: "candidate", hairstyleId: "style", prompt: "Exact hair-only prompt", sourceRnDAttemptId: "attempt-0", qaStatus: "PASSED" };
const admin = { role: "ADMIN", isActive: true, isDeleted: false };
function cohort(): any[] {
  return Array.from({ length: 20 }, (_, i) => Array.from({ length: 3 }, (_, j) => {
    const value = i === 0 ? 9.5 : 8 + i / 10;
    return { id: `${i}-${j}`, attemptId: `attempt-${i}`, reviewedByUserId: `admin-${j}`, reviewerKey: `admin:admin-${j}`, reviewedByUser: admin,
      reviewedAt: new Date("2026-01-01"), promptChecksum: sha(candidate.prompt), artifactChecksum: sha(`artifact-${i}`), humanOverallScore: value, humanHairstyleScore: value,
      attempt: { prompt: candidate.prompt, jobId: `job-${i}`, attemptNumber: 1, overallScore: value, generationCompletedAt: new Date("2026-01-01"),
        artifact: { kind: "GENERATED", checksum: sha(`artifact-${i}`), storageKey: `rnd/attempts/job-${i}/1-image` },
        job: { target: { hairstyleId: "style", sourceAsset: { checksum: sha(`source-${i}`) } } } } };
  })).flat();
}
async function main() {
  let count = 0;
  const check = (v: unknown) => { assert.ok(v); count++; };
  let rows = cohort(), run: any = null;
  const tx: any = { $queryRaw: async () => [{ locked: 1 }], rnDQAReferenceRating: { findMany: async () => rows }, rnDPromptCalibration: { findFirst: async () => run } };
  const computed = await computeCalibration(tx, candidate);
  check(computed.result === "PASSED"); check(computed.summary.sampleCount === 20); check(computed.summary.correlation === 1);
  check(!await hasVerifiedCalibration(tx, candidate));
  const valid = { ...computed, promptVersionId: candidate.id, hairstyleId: candidate.hairstyleId, sourceAttemptId: candidate.sourceRnDAttemptId,
    completedAt: new Date("2026-01-01"), executedByUser: admin, policyVersion: CALIBRATION_POLICY_VERSION };
  run = valid; check(await hasVerifiedCalibration(tx, candidate));
  for (const change of [{ result: "FAILED" }, { promptVersionId: "other" }, { hairstyleId: "other" }, { sourceAttemptId: "other" },
    { promptChecksum: sha("other") }, { evidenceDigest: sha("forged") }, { summary: {} }, { policyVersion: "caller-policy" },
    { completedAt: new Date(Date.now() + 60_000) }, { completedAt: new Date("invalid") }, { executedByUser: { ...admin, role: "USER" } }, { executedByUser: { ...admin, isActive: false } }]) {
    run = { ...valid, ...change }; check(!await hasVerifiedCalibration(tx, candidate));
  }
  run = valid; check(!await hasVerifiedCalibration(tx, { ...candidate, qaStatus: "DRAFT" }));
  check(!await hasVerifiedCalibration(tx, { ...candidate, sourceRnDAttemptId: null }));
  for (const mutate of [
    (r: any[]) => r.slice(0, 57),
    (r: any[]) => r.map(v => ({ ...v, reviewedByUser: { ...admin, role: "USER" } })),
    (r: any[]) => r.map(v => ({ ...v, reviewerKey: "caller-key" })),
    (r: any[]) => r.map(v => ({ ...v, artifactChecksum: sha("wrong") })),
    (r: any[]) => r.map(v => ({ ...v, attempt: { ...v.attempt, prompt: "other" } })),
    (r: any[]) => r.map(v => ({ ...v, attempt: { ...v.attempt, job: { target: { sourceAsset: { checksum: sha("same source") } } } } })),
    (r: any[]) => [...r, ...Array.from({ length: 1441 }, () => r[0])],
  ]) { rows = mutate(cohort()); check((await computeCalibration(tx, candidate)).result === "INCOMPLETE"); }
  rows = cohort().map(r => ({ ...r, humanOverallScore: 8, humanHairstyleScore: 8 }));
  check((await computeCalibration(tx, candidate)).result === "FAILED");
  rows = cohort().map(r => ({ ...r, humanHairstyleScore: r.attemptId === candidate.sourceRnDAttemptId ? 9.49 : r.humanHairstyleScore }));
  check((await computeCalibration(tx, candidate)).result === "FAILED");
  rows = cohort();
  const key = "RND_QA_CALIBRATION_MIN_SAMPLES", saved = process.env[key];
  try { process.env[key] = "1"; await assert.rejects(computeCalibration(tx, candidate), /POLICY_INVALID/); count++; }
  finally { if (saved === undefined) delete process.env[key]; else process.env[key] = saved; }

  let session: any = null, effects = 0;
  const load = (file: string, overrides: Record<string, unknown> = {}) => {
    const mod = { exports: {} as any }, code = transformSync(readFileSync(file, "utf8"), { loader: "ts", format: "cjs" }).code;
    new Function("require", "module", "exports", code)((name: string) => {
      if (name in overrides) return overrides[name];
      if (name === "next/server") return { NextResponse: { json: (v: unknown, init?: ResponseInit) => Response.json(v, init) } };
      if (name === "@/auth") return { auth: async () => session };
      if (name === "@/lib/prisma") return { prisma: new Proxy({}, { get: () => { effects++; throw new Error("DB must not be touched"); } }) };
      if (name === "./review/route") return load("app/api/rnd/qa-calibration/review/route.ts");
      return name.startsWith("@/") ? req("../" + name.slice(2)) : req(name);
    }, mod, mod.exports); return mod.exports;
  };
  for (const file of ["app/api/rnd/qa-calibration/complete/route.ts", "app/api/rnd/qa-calibration/review/route.ts", "app/api/rnd/qa-calibration/smoke/route.ts"]) {
    const route = load(file), call = route.POST ?? route.GET;
    for (const s of [null, { user: { id: "worker", role: "USER" } }]) {
      session = s; const request = new Request("https://fixture.invalid", { method: "POST", headers: { authorization: "Bearer worker" } });
      request.json = async () => { effects++; throw new Error("Body must not be read"); };
      check((await call(request)).status === 401); check(effects === 0);
    }
    session = { user: { id: "admin", role: "ADMIN" } };
    check((await call(new Request("https://fixture.invalid", { method: "POST", body: JSON.stringify({ promptVersionId: "id", result: "PASSED" }) }))).status === (file.includes("smoke") ? 410 : 400)); check(effects === 0);
  }

  const workerRead = load("app/api/rnd/qa-calibration/route.ts", { "@/lib/rnd/worker-auth": { requireRndWorker: (value: string | null) => value === "Bearer worker" ? null : Response.json({ code: "UNAUTHORIZED" }, { status: 401 }) } }).GET;
  const workerReadResponse = await workerRead(new Request("https://fixture.invalid", { headers: { authorization: "Bearer worker" } }));
  check(workerReadResponse.status === 410);
  const workerReadBody = await workerReadResponse.json(); check(workerReadBody.code === "RND_CALIBRATION_WORKER_READ_DISABLED");
  check(!JSON.stringify(workerReadBody).includes("humanOverallScore")); check(effects === 0);

  const bytes = Buffer.from("synthetic review image"), oldFetch = globalThis.fetch;
  let artifact: any = { blobUrl: "https://fixture.invalid/artifact", kind: "GENERATED", mimeType: "image/png", fileSize: bytes.length, checksum: sha(bytes.toString()) };
  let imageAdmin: any = admin, issuedReceipt: any = null;
  const image = load("app/api/rnd/qa-calibration/review/image/route.ts", { "@/lib/prisma": { prisma: {
    $transaction: async (fn: any) => fn({ rnDQAReviewReceipt: { create: async ({ data }: any) => { issuedReceipt = data; return data; } } }),
    user: { findUnique: async () => imageAdmin }, rnDAttempt: { findUnique: async () => ({ id: "attempt", prompt: "Exact hair-only prompt", artifact }) },
  } }, "@/lib/rnd/admin-auth": { lockActiveAdmin: async () => true }, "@/lib/rnd/blob-storage": { requireRndBlobToken: () => "synthetic-only" } }).GET;
  try {
    globalThis.fetch = async (_url, init) => { check(init?.redirect === "error"); check((init?.headers as any).Authorization === "Bearer synthetic-only"); return new Response(bytes); };
    const request = new Request("https://fixture.invalid/?attemptId=attempt");
    const delivered = await image(request); check(delivered.status === 200);
    const receiptToken = delivered.headers.get("x-rnd-review-receipt"); check(Boolean(receiptToken)); check(issuedReceipt?.attemptId === "attempt");
    imageAdmin = { ...admin, role: "USER" }; check((await image(request)).status === 401);
    imageAdmin = admin;
    artifact = { ...artifact, checksum: sha("wrong") }; check((await image(request)).status === 502);
    artifact = { ...artifact, checksum: sha(bytes.toString()), fileSize: bytes.length + 1 }; check((await image(request)).status === 502);
    globalThis.fetch = async () => { throw new Error("synthetic secret must not escape"); };
    const failed = await image(request); check(failed.status === 502); check(!(await failed.text()).includes("synthetic secret"));
  } finally { globalThis.fetch = oldFetch; }

  let createCalls = 0, reviewAdmin: any = admin, duplicate = false, receiptAvailable = true;
  const reviewTx: any = {
    $queryRaw: async () => reviewAdmin.role === "ADMIN" ? [{ id: "admin-1" }] : [],
    user: { findUnique: async () => reviewAdmin },
    rnDAttempt: { findUnique: async () => ({ id: "attempt-1", jobId: "job-1", attemptNumber: 1, prompt: "Exact hair-only prompt", overallScore: 9.6,
      generationCompletedAt: new Date(), artifact: { kind: "GENERATED", checksum: sha("image"), storageKey: "rnd/attempts/job-1/1-image" } }) },
    rnDQAReviewReceipt: { updateMany: async () => { if (!receiptAvailable) return { count: 0 }; receiptAvailable = false; return { count: 1 }; } },
    rnDQAReferenceRating: { create: async () => { createCalls++; if (duplicate) { const error: any = new Error("unique"); error.code = "P2002"; throw error; } return { id: "new-rating" }; } },
  };
  const reviewRoute = load("app/api/rnd/qa-calibration/review/route.ts", { "@/lib/prisma": { prisma: { ...reviewTx, $transaction: async (fn: any) => fn(reviewTx) } } }).POST;
  session = { user: { id: "admin-1", role: "ADMIN" } };
  const reviewRequest = () => new Request("https://fixture.invalid", { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ attemptId: "attempt-1", receiptToken: "synthetic-receipt-token-value-1234567890", humanOverallScore: 9.7, humanHairstyleScore: 9.6 }) });
  check((await reviewRoute(reviewRequest())).status === 201); check(createCalls === 1);
  check((await reviewRoute(reviewRequest())).status === 409); check(createCalls === 1);
  receiptAvailable = true; duplicate = true;
  check((await reviewRoute(reviewRequest())).status === 409); check(createCalls === 2);
  reviewAdmin = { ...admin, role: "USER" }; check((await reviewRoute(reviewRequest())).status === 401);

  console.log(`PASS ${count} calibration/evidence/auth/review-image/receipt/append-only behavioral assertions; mocked I/O only, no provider or database access.`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
