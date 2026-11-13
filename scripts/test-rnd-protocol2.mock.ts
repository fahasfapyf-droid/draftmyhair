import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { RND_WORKER_PROTOCOL_VERSION, verifyRndWorkerHello } from "../lib/rnd/worker-protocol";

async function main() {
  assert.equal(RND_WORKER_PROTOCOL_VERSION, "2");
  await verifyRndWorkerHello(new Response(JSON.stringify({ ok: true, protocolVersion: "2" }), { status: 200 }));
  await assert.rejects(() => verifyRndWorkerHello(new Response(JSON.stringify({ ok: true, protocolVersion: "1" }), { status: 200 })), /Unsupported worker protocol/);
  await assert.rejects(() => verifyRndWorkerHello(new Response("denied", { status: 403 })), /HTTP 403/);

  const claim = await readFile("app/api/rnd/worker/claim/route.ts", "utf8");
  const submission = await readFile("app/api/rnd/worker/submission/route.ts", "utf8");
  const artifacts = await readFile("app/api/rnd/worker/artifacts/route.ts", "utf8");
  const report = await readFile("app/api/rnd/worker/report/route.ts", "utf8");
  const worker = await readFile("tools/rnd-worker/worker.ts", "utf8");

  assert.ok(claim.includes('headers.get("x-rnd-worker-protocol") !== RND_WORKER_PROTOCOL_VERSION'));
  assert.ok(claim.includes('promptRevision: "reserved-v2"'));
  assert.ok(claim.includes('submittedAt: null'));
  assert.ok(claim.includes('RND_SUBMISSION_REQUIRES_RECONCILIATION'));
  assert.ok(claim.includes('reservation.generationStartedAt || reservation.artifactId || reservation.errorCode'),
    "a restarted worker cannot claim and blindly resubmit a dispatched generation");
  assert.ok(submission.includes('phase !== "begin" && phase !== "submitted"'));
  assert.ok(submission.includes('fenceRndReportLease(tx'));
  assert.ok(submission.includes('RND_SUBMISSION_UNCERTAIN'));
  assert.ok(submission.includes('RND_SUBMITTED'));
  assert.ok(artifacts.includes('attempt?.errorCode !== "RND_SUBMITTED"'));
  assert.ok(artifacts.includes('where: { jobId_attemptNumber: { jobId, attemptNumber } }'), "artifact association is scoped to the claimed job and attempt");
  assert.ok(artifacts.includes('jobId, workerId, claimStartedAt: claimGeneration'), "artifact commit is fenced to the current job lease");
  assert.ok(artifacts.includes('generationCompletedAt: new Date()'));
  assert.ok(report.includes('reservation.promptRevision !== "reserved-v2"'));
  assert.ok(report.includes('reservation.errorCode !== "RND_SUBMITTED"'));
  assert.ok(report.includes('generationCompletedAt = reservation.generationCompletedAt'));
  assert.ok(worker.includes('await recordSubmission(job, "begin")'));
  assert.ok(worker.includes('await recordSubmission(job, "submitted")'));
  assert.match(await readFile("tools/rnd-worker/gemini-page.ts", "utf8"), /submitPrompt\(page: Page, prompt: string, freshPath: string, timeout = 300_000\)/,
    "the response wait exceeds the historical 72 second successful generation");
  assert.ok(worker.includes('verifyRndWorkerHello(await api("/api/rnd/worker/hello"))'));

  console.log("PASS Protocol 2 handshake, legacy rejection, submission fencing, artifact gating, and worker call-order checks.");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
