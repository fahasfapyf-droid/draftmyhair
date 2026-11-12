/** Real PostgreSQL/Prisma transactions, synthetic local rows ONLY. Providers/auth sessions are fake. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { transformSync } from "esbuild";
import * as provenance from "../lib/rnd/promotion-provenance";
import { runCalibrationCases } from "./rnd-calibration-fixtures";

const req = createRequire(import.meta.url);
const prefix = "review71-" + randomUUID();
const bytes = Buffer.from("synthetic original artifact bytes, no customer photograph");
const checksum = createHash("sha256").update(bytes).digest("hex");
const scores = { overall: 9.5, identity: 9.5, styleAccuracy: 9.5, rootIntegration: 9.5, lightingConsistency: 9.5, hairOnly: "PASS", artifacts: "NONE", reason: "synthetic test", refinement: "" };
const qaJson = () => ({ ...scores, verdict: "APPROVE", imageIntegrity: { canvasMatch: true, faceTexturePreservationPass: true }, finalVerification: { ...scores, verdict: "PASS" } });
let session: any = { user: { id: "local-synthetic-admin", role: "ADMIN" } };
let prisma: any;
let cleanupClient: any;
let db: any;
let serial = 0;
let qaBarrier: (() => Promise<void>) | null = null;
function barrier() { let count = 0; let release!: () => void; const wait = new Promise<void>(r => { release = r; }); return async () => { if (++count === 2) release(); await wait; }; }
function request(body: unknown, worker = "worker-a", method = "POST") { return new Request("https://local-test.invalid/handler", { method,
  headers: { authorization: "Bearer local-test-only", "x-rnd-worker-id": worker, "x-rnd-worker-protocol": "2", "content-type": "application/json" }, body: method === "GET" ? undefined : JSON.stringify(body) }); }
function handler(file: string, baseline: boolean | string = false) {
  const source = baseline ? execFileSync("git", ["show", (typeof baseline === "string" ? baseline : "f463f347") + ":" + file], { encoding: "utf8" }) : readFileSync(file, "utf8");
  const code = transformSync(source, { loader: "ts", format: "cjs", target: "node20" }).code;
  const mod = { exports: {} as any };
  const modules: Record<string, unknown> = {
    "next/server": { NextResponse: { json: (v: unknown, init?: ResponseInit) => Response.json(v, init) } },
    "@/auth": { auth: async () => session }, "@/lib/prisma": { prisma: db },
    "@/lib/rnd/source-asset": { fetchRndSourceAsset: async () => ({ buffer: bytes, mimeType: "image/png" }) },
    "@/lib/rnd/blob-storage": { requireRndBlobToken: () => "local-stub-not-a-credential" },
    "@vercel/blob": { put: async () => ({ url: "https://blob-fixture.invalid/" + randomUUID() }), del: async () => undefined },
    "@/lib/rnd/qa": { runRndQa: async () => { if (qaBarrier) await qaBarrier(); return { ...scores, verdict: "APPROVE" }; }, runRndFinalVerification: async () => ({ ...scores, verdict: "PASS" }) },
    "@/lib/rnd/image-integrity": { passesRndHardIntegrityGate: (v: any) => v?.canvasMatch === true && v?.faceTexturePreservationPass === true, runRndImageIntegrityCheck: async () => ({ canvasMatch: true, faceTexturePreservationPass: true }) },
    "@/lib/rnd/hindsight": { hindsightEnabled: () => false, recallRndHistory: async () => [], retainRndOutcome: async () => false },
    "@/lib/rnd/refinement-learning": { chooseRndRefinement: async (candidate: unknown) => ({ candidate, decision: "DETERMINISTIC_FALLBACK", evidenceIds: [] }) },
  };
  new Function("require", "module", "exports", "setTimeout", code)((name: string) => {
    if (name in modules) return modules[name];
    if (name.startsWith(".")) return handler(path.posix.join(path.posix.dirname(file), name) + ".ts");
    return name.startsWith("@/") ? req("../" + name.slice(2)) : req(name);
  }, mod, mod.exports, (fn: () => void, ms: number) => { const timer = setTimeout(fn, ms); timer.unref(); return timer; });
  return mod.exports;
}
async function clean() {
  qaBarrier = null;
  if (cleanupClient) {
    await cleanupClient.query("BEGIN");
    try {
      await cleanupClient.query("SET LOCAL ROLE dmh_calibration_cleanup");
      const promptIds = (await prisma.promptVersion.findMany({ where: { hairstyleId: { startsWith: prefix } }, select: { id: true } })).map((v: any) => v.id);
      if (promptIds.length) await cleanupClient.query('DELETE FROM "RnDPromptCalibration" WHERE "promptVersionId" = ANY($1::text[])', [promptIds]);
      const attemptIds = (await prisma.rnDAttempt.findMany({ where: { job: { target: { campaignId: { startsWith: prefix } } }, calibrationRatings: { some: {} } }, select: { id: true } })).map((v: any) => v.id);
      if (attemptIds.length) await cleanupClient.query('DELETE FROM "RnDQAReferenceRating" WHERE "attemptId" = ANY($1::text[])', [attemptIds]);
      await cleanupClient.query("COMMIT");
    } catch (error) { await cleanupClient.query("ROLLBACK"); throw error; }
  }
  await prisma.promptVersion.deleteMany({ where: { hairstyleId: { startsWith: prefix } } });
  await prisma.rnDCampaign.deleteMany({ where: { id: { startsWith: prefix } } });
  await prisma.hairstyle.deleteMany({ where: { id: { startsWith: prefix } } });
  await prisma.user.deleteMany({ where: { id: { startsWith: prefix } } });
}
async function seed(status = "HUMAN_APPROVAL", style?: string) {
  const tag = prefix + "-" + (++serial);
  const styleId = style ?? tag + "-style";
  if (!style) await prisma.hairstyle.create({ data: { id: styleId, slug: styleId, name: "Synthetic Bob", promptKey: styleId, gender: "UNISEX" } });
  const source = await prisma.rnDAsset.create({ data: { id: tag + "-source", kind: "SOURCE", storageKey: tag + "-source", blobUrl: "https://blob-fixture.invalid/" + tag + "-source", mimeType: "image/png", fileSize: bytes.length, checksum } });
  const campaign = await prisma.rnDCampaign.create({ data: { id: tag + "-campaign", name: "Disposable regression only", createdByUserId: "synthetic" } });
  const target = await prisma.rnDTarget.create({ data: { id: tag + "-target", campaignId: campaign.id, targetType: "SINGLE", targetKey: tag, hairstyleId: styleId, sourceAssetId: source.id, status } });
  const job = await prisma.rnDJob.create({ data: { id: tag + "-job", targetId: target.id, status, currentPrompt: "Immutable hair-only synthetic Bob prompt", attemptCount: status === "HUMAN_APPROVAL" ? 1 : 0 } });
  if (status === "HUMAN_APPROVAL") {
    const asset = await prisma.rnDAsset.create({ data: { id: tag + "-artifact", kind: "GENERATED", storageKey: `rnd/attempts/${job.id}/1-test`, blobUrl: "https://blob-fixture.invalid/" + tag, mimeType: "image/png", fileSize: bytes.length, checksum } });
    await prisma.rnDAttempt.create({ data: { id: tag + "-attempt", jobId: job.id, attemptNumber: 1, prompt: job.currentPrompt, promptRevision: "scored", submittedAt: new Date(), generationCompletedAt: new Date(), artifactId: asset.id,
      qaJson: qaJson(), overallScore: 9.5, aiGatePassed: true, publicationTierPassed: true, verdict: "HUMAN_APPROVAL" } });
  }
  return { ...job, styleId, tag };
}
async function run() {
  assert.ok(process.argv.includes("--disposable-local-only"), "Explicit disposable DB opt-in required");
  const manifest = process.env.DMH71_DB_MANIFEST;
  assert.ok(manifest && process.env.DMH71_PRISMA_CLIENT, "External test manifest and generated client required; no .env fallback");
  const meta = JSON.parse(readFileSync(manifest, "utf8"));
  assert.equal(meta.host, "127.0.0.1"); assert.match(meta.database, /^dmh71_review_[a-f0-9]+$/); assert.ok(meta.data.includes("dmh71-pg-review-"));
  process.env.RND_WORKER_TOKEN = "local-test-only";
  const { PrismaClient } = req(process.env.DMH71_PRISMA_CLIENT!);
  prisma = new PrismaClient({ datasources: { db: { url: `postgresql://${meta.user}@127.0.0.1:${meta.port}/${meta.database}?schema=public` } } }); db = prisma;
  await prisma.user.upsert({ where: { id: "local-synthetic-admin" }, create: { id: "local-synthetic-admin", email: "local-synthetic-admin@fixture.invalid", role: "ADMIN" }, update: { role: "ADMIN", isActive: true, isDeleted: false } });
  const { Client } = req("pg"); cleanupClient = new Client({ host: "127.0.0.1", port: meta.port, user: meta.user, database: meta.database }); await cleanupClient.connect();
  const identity = await prisma.$queryRawUnsafe("SELECT current_database() AS database, host(inet_server_addr()) AS host, current_setting('data_directory') AS directory, version() AS version");
  assert.equal(identity[0].database, meta.database); assert.equal(identity[0].host, "127.0.0.1");
  assert.equal(identity[0].directory.replaceAll("\\", "/").toLowerCase(), meta.data.replaceAll("\\", "/").toLowerCase());
  console.log("VERIFIED disposable PostgreSQL identity", JSON.stringify(identity));
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async url => { assert.ok(String(url).startsWith("https://blob-fixture.invalid/")); return new Response(bytes); };
  try {
    await clean();
    const first = await seed(), second = await seed("HUMAN_APPROVAL", first.styleId);
    const rendezvous = barrier();
    db = new Proxy(prisma, { get: (target, property) => property === "$transaction" ? (fn: any) => target.$transaction((tx: any) => fn(new Proxy(tx, { get: (t, p) => p === "promptVersion" ? new Proxy(t[p], { get: (m, method) => method === "findFirst" ? async (...args: any[]) => { const value = await m.findFirst(...args); await rendezvous(); return value; } : m[method] }) : t[p] })), { timeout: 10000 }) : target[property] });
    const oldApproval = handler("app/api/rnd/approval/approve/route.ts", true).POST;
    const collision = await Promise.allSettled([oldApproval(request({ jobId: first.id })), oldApproval(request({ jobId: second.id }))]);
    assert.equal(collision.filter(v => v.status === "rejected" && v.reason.code === "P2002").length, 1);
    console.log("REPRODUCED starting HEAD defect: concurrent same-style imports select version 1 twice; one real Prisma P2002 rollback.");
    db = prisma; await clean();
    if (!process.argv.includes("--no-worker-dispatch")) {
    const claim = handler("app/api/rnd/worker/claim/route.ts").POST, submission = handler("app/api/rnd/worker/submission/route.ts").POST;
    const queued = await seed("QUEUED");
    const claims = await Promise.all([claim(request({}, "worker-a")), claim(request({}, "worker-b"))]);
    const payloads = await Promise.all(claims.map((r: Response) => r.json()));
    const winner = payloads.find(v => v.job); assert.equal(payloads.filter(v => v.job).length, 1); assert.equal(winner.job.id, queued.id);
    assert.equal(await prisma.rnDAttempt.count({ where: { jobId: queued.id } }), 1);
    const reservation = await prisma.rnDAttempt.findFirst({ where: { jobId: queued.id } }); assert.equal(reservation.submittedAt, null);
    await prisma.rnDJob.update({ where: { id: queued.id }, data: { leaseExpiresAt: new Date(Date.now() - 1000) } });
    const recoveries = await Promise.all([claim(request({}, winner.workerId)), claim(request({}, winner.workerId))]);
    const recoveredPayloads = await Promise.all(recoveries.map((r: Response) => r.json()));
    assert.equal(recoveredPayloads.filter(r => r.job).length, 1);
    const reclaimed = recoveredPayloads.find(r => r.job); assert.ok(reclaimed.job);
    assert.notEqual(reclaimed.job.claimGeneration, winner.job.claimGeneration);
    const heartbeat = handler("app/api/rnd/worker/heartbeat/route.ts").POST;
    assert.equal((await heartbeat(request({ jobId: queued.id, claimGeneration: winner.job.claimGeneration }, winner.workerId))).status, 409);
    const lease = await prisma.rnDJob.findUnique({ where: { id: queued.id } }); assert.equal(lease.infrastructureRetryCount, 1); assert.equal(lease.attemptCount, 0);
    const beginResponse = await submission(request({ jobId: queued.id, attemptNumber: 1, claimGeneration: reclaimed.job.claimGeneration, phase: "begin" }, winner.workerId));
    if (beginResponse.status !== 200) console.log("FENCE DIAGNOSTIC", JSON.stringify(await beginResponse.clone().json()), JSON.stringify(await prisma.$queryRawUnsafe(`SELECT "startedAt"::text, "leaseExpiresAt"::text, clock_timestamp()::text AS clock, current_setting('TimeZone') AS timezone, "leaseExpiresAt" > clock_timestamp() AS current_check, "leaseExpiresAt" > (clock_timestamp() AT TIME ZONE 'UTC') AS utc_check FROM "RnDJob" WHERE "id" = $1`, queued.id)));
    assert.equal(beginResponse.status, 200);
    let begun = await prisma.rnDAttempt.findFirst({ where: { jobId: queued.id } }); assert.equal(begun.submittedAt, null); assert.equal(begun.errorCode, "RND_SUBMISSION_UNCERTAIN");
    await prisma.rnDJob.update({ where: { id: queued.id }, data: { leaseExpiresAt: new Date(Date.now() - 1000) } });
    assert.equal((await (await claim(request({}, winner.workerId))).json()).job, null);
    assert.equal((await prisma.rnDJob.findUnique({ where: { id: queued.id } })).status, "FAILED");
    console.log("PASS real DB: concurrent claims, clean reservation, same-worker reclaim, stale heartbeat, infrastructure accounting, uncertain submission never redispatched.");
    await clean(); await seed("QUEUED");
    const captureClaim = await (await claim(request({}))).json(); const j = captureClaim.job;
    for (const phase of ["begin", "submitted"]) assert.equal((await submission(request({ jobId: j.id, attemptNumber: 1, claimGeneration: j.claimGeneration, phase }))).status, 200);
    begun = await prisma.rnDAttempt.findFirst({ where: { jobId: j.id } }); assert.ok(begun.submittedAt instanceof Date);
    const artifact = handler("app/api/rnd/worker/artifacts/route.ts").POST;
    const upload = () => { const form = new FormData(); form.set("jobId", j.id); form.set("attemptNumber", "1"); form.set("claimGeneration", j.claimGeneration); form.set("file", new File([bytes], "synthetic.png", { type: "image/png" })); return artifact(new Request("https://local-test.invalid/artifacts", { method: "POST", headers: { authorization: "Bearer local-test-only", "x-rnd-worker-id": "worker-a" }, body: form })); };
    const uploads = await Promise.all([upload(), upload()]); assert.ok(uploads.every(r => r.status === 200));
    const assets = await Promise.all(uploads.map(r => r.json())); assert.equal(assets[0].artifactId, assets[1].artifactId);
    const report = handler("app/api/rnd/worker/report/route.ts").POST;
    qaBarrier = barrier();
    const reportBody = { jobId: j.id, attemptNumber: 1, claimGeneration: j.claimGeneration, artifactId: assets[0].artifactId };
    const reports = await Promise.all([report(request(reportBody)), report(request(reportBody))]); qaBarrier = null;
    assert.deepEqual(reports.map(r => r.status).sort(), [200, 409]); assert.equal(await prisma.rnDAttempt.count({ where: { jobId: j.id } }), 1);
    assert.equal((await report(request(reportBody))).status, 409, "lost successful report response cannot cause a second transition");
    console.log("PASS real DB: submitted timestamp, concurrent artifact idempotence, duplicate report CAS, lost report response remains safe.");
    } else console.log("SKIP worker claim/submission/artifact/report execution: --no-worker-dispatch. These paths run only in offline mocks in this review.");
    const approve = handler("app/api/rnd/approval/approve/route.ts").POST, reject = handler("app/api/rnd/approval/reject/route.ts").POST;
    await clean(); const contested = await seed();
    const decision = await Promise.all([approve(request({ jobId: contested.id })), reject(request({ jobId: contested.id }))]);
    assert.deepEqual(decision.map(r => r.status).sort(), [200, 409]);
    const decided = await prisma.rnDJob.findUnique({ where: { id: contested.id }, include: { target: true } });
    assert.equal(decided.target.status, decided.status === "COMPLETED" ? "APPROVED" : "REJECTED");
    await clean(); const duplicate = await seed();
    const approvals = await Promise.all([approve(request({ jobId: duplicate.id })), approve(request({ jobId: duplicate.id }))]);
    assert.deepEqual(approvals.map(r => r.status).sort(), [200, 409]); assert.equal(await prisma.promptVersion.count(), 1);
    const approved = await prisma.rnDAttempt.findFirst({ where: { jobId: duplicate.id }, include: { artifact: true } }); assert.equal(provenance.verifiedHumanApproval(approved), true);
    await assert.rejects(prisma.rnDAttempt.delete({ where: { id: approved.id } }), (error: any) => error.code === "P2003", "linked approval provenance cannot be deleted");
    await clean(); const a = await seed(), b = await seed("HUMAN_APPROVAL", a.styleId);
    const imports = await Promise.all([approve(request({ jobId: a.id })), approve(request({ jobId: b.id }))]); assert.ok(imports.every(r => r.status === 200));
    assert.deepEqual((await prisma.promptVersion.findMany({ orderBy: { version: "asc" } })).map((v: any) => v.version), [1, 2]);
    console.log("PASS real DB: approval/rejection conflict, duplicate approval, durable exact human proof, same-style imports serialized without duplicate versions.");
    await runCalibrationCases({ prisma, handler, request, seed, clean, prefix, setSession: value => { session = value; } });
    if (!process.argv.includes("--no-worker-dispatch")) {
    const claim = handler("app/api/rnd/worker/claim/route.ts").POST;
    const staleFence = req("../lib/rnd/report-lease-fence"); await clean(); const stale = await seed("QUEUED");
    const old = await (await claim(request({}))).json(); await prisma.rnDJob.update({ where: { id: stale.id }, data: { leaseExpiresAt: new Date(Date.now() - 1) } });
    const attempt = await prisma.rnDAttempt.findFirst({ where: { jobId: stale.id } });
    const [newerResponse, staleCommitted] = await Promise.all([claim(request({})), prisma.$transaction((tx: any) => staleFence.fenceRndReportLease(tx, { jobId: stale.id, workerId: "worker-a", claimStartedAt: new Date(old.job.claimGeneration), expectedAttemptCount: 0, attemptId: attempt.id, attemptNumber: 1 }))]);
    const newer = await newerResponse.json(); assert.equal(staleCommitted, false);
    assert.equal((await prisma.rnDJob.findUnique({ where: { id: stale.id } })).startedAt.toISOString(), newer.job.claimGeneration);
    for (const zone of ["UTC", "Asia/Karachi", "America/New_York"]) {
      const accepted = await prisma.$transaction(async (tx: any) => {
        await tx.$executeRawUnsafe(`SET LOCAL TIME ZONE '${zone}'`);
        return staleFence.fenceRndReportLease(tx, { jobId: stale.id, workerId: "worker-a", claimStartedAt: new Date(newer.job.claimGeneration), expectedAttemptCount: 0, attemptId: attempt.id, attemptNumber: 1 });
      });
      assert.equal(accepted, true, "live generation must fence correctly in " + zone);
      const timed = await prisma.rnDJob.findUnique({ where: { id: stale.id } }); assert.ok(Math.abs(Date.now() - timed.heartbeatAt.getTime()) < 2000);
    }
    const release = handler("app/api/rnd/worker/release/route.ts").POST;
    assert.equal((await release(request({ jobId: stale.id, claimGeneration: old.job.claimGeneration }))).status, 409);
    assert.equal((await release(request({ jobId: stale.id, claimGeneration: newer.job.claimGeneration }))).status, 200);
    const released = await prisma.rnDJob.findUnique({ where: { id: stale.id } });
    assert.equal(released.status, "QUEUED"); assert.equal(released.infrastructureRetryCount, 2); assert.equal(released.attemptCount, 0);
    assert.ok(released.nextEligibleAt.getTime() > Date.now() && released.nextEligibleAt.getTime() < Date.now() + 600001);
    console.log("PASS real DB: stale report fence loses after newer claim generation. No exactly-once Gemini/provider claim is made.");
    } else console.log("SKIP live claim/reclaim/release DB cases: --no-worker-dispatch; no worker endpoint dispatched.");
  } finally { globalThis.fetch = originalFetch; await clean(); await cleanupClient?.end(); await prisma.$disconnect(); }
}
run().catch(async error => { console.error(error); await prisma?.$disconnect(); process.exitCode = 1; });
