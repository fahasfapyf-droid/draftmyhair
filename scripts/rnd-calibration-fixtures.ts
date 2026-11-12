/** Synthetic fixtures on the newly created loopback DB only. No worker dispatch,
 * image generation, provider traffic, or real human calibration is represented. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { lockActiveAdmin } from "../lib/rnd/admin-auth";

type Context = {
  prisma: any;
  handler: (file: string, baseline?: boolean | string) => any;
  request: (body: unknown, worker?: string, method?: string) => Request;
  seed: (status?: string, style?: string) => Promise<any>;
  clean: () => Promise<void>;
  prefix: string;
  setSession: (session: any) => void;
};
const sha = (value: string) => createHash("sha256").update(value).digest("hex");

export async function runCalibrationCases({ prisma, handler, request, seed, clean, prefix, setSession }: Context) {
  await clean();
  const admins = await Promise.all([0, 1, 2, 3].map(i => prisma.user.create({ data: { id: `${prefix}-admin-${i}`, email: `${prefix}-${i}@test.invalid`, role: "ADMIN" } })));
  const as = (i: number) => setSession({ user: { id: admins[i].id, role: "ADMIN" } });
  let releaseLock!: () => void, acquiredLock!: () => void;
  const lockGate = new Promise<void>(resolve => { releaseLock = resolve; });
  const lockAcquired = new Promise<void>(resolve => { acquiredLock = resolve; });
  const heldAdminLock = prisma.$transaction(async (tx: any) => { assert.equal(await lockActiveAdmin(tx, admins[0].id), true); acquiredLock(); await lockGate; });
  await lockAcquired;
  let demotionFinished = false;
  const concurrentDemotion = prisma.user.update({ where: { id: admins[0].id }, data: { role: "USER" } }).then(() => { demotionFinished = true; });
  await new Promise(resolve => setTimeout(resolve, 100));
  assert.equal(demotionFinished, false, "FOR SHARE actor lock blocks concurrent role demotion until protected transaction commits");
  releaseLock(); await heldAdminLock; await concurrentDemotion;
  await prisma.user.update({ where: { id: admins[0].id }, data: { role: "ADMIN" } });
  as(0);
  const job = await seed();
  const approve = handler("app/api/rnd/approval/approve/route.ts").POST;
  assert.equal((await approve(request({ jobId: job.id }))).status, 200);
  const source = await prisma.rnDAttempt.findFirst({ where: { jobId: job.id }, include: { promptVersion: true, job: { include: { target: true } } } });
  const candidate = source.promptVersion;
  const body = { promptKey: job.styleId, sourceAttemptId: source.id, sourceJobId: job.id, prompt: job.currentPrompt };
  const params = { params: Promise.resolve({ id: candidate.id }) };
  const patchBody = (v: unknown) => request(v, "worker-a", "PATCH");
  const patch = handler("app/api/dashboard/admin/content/prompts/[id]/route.ts").PATCH;
  const promote = handler("app/api/internal/prompt-promote/route.ts").POST;
  const complete = handler("app/api/rnd/qa-calibration/complete/route.ts").POST;
  const review = handler("app/api/rnd/qa-calibration/review/route.ts").POST;
  const create = handler("app/api/dashboard/admin/content/prompts/route.ts").POST;

  // The session stub deliberately remains ADMIN while the database row is demoted.
  // Every prompt mutation must revalidate and hold the actor row lock in-transaction.
  await prisma.user.update({ where: { id: admins[0].id }, data: { role: "USER" } });
  assert.equal((await patch(patchBody({ status: "ACTIVE" }), params)).status, 401, "prompt activation rejects role demotion after session authentication");
  assert.equal((await create(request({ hairstyleId: job.styleId, prompt: "demoted admin draft" }))).status, 401, "prompt creation rejects role demotion after session authentication");
  await prisma.user.update({ where: { id: admins[0].id }, data: { role: "ADMIN" } });

  // Exact starting-HEAD bypass, then restore only these synthetic fixture rows.
  const oldPatch = handler("app/api/dashboard/admin/content/prompts/[id]/route.ts", "eccc81bd").PATCH;
  const oldPromote = handler("app/api/internal/prompt-promote/route.ts", "eccc81bd").POST;
  assert.equal((await oldPatch(patchBody({ qaStatus: "PASSED" }), params)).status, 200);
  assert.equal((await oldPromote(request(body))).status, 200);
  assert.equal(await prisma.rnDPromptCalibration.count(), 0);
  console.log("REPRODUCED eccc81bd calibration bypass: ADMIN PATCH PASSED -> promotion 200, zero completion records (synthetic disposable rows only).");
  await prisma.promptVersion.update({ where: { id: candidate.id }, data: { status: "DRAFT", qaStatus: "DRAFT" } });

  assert.equal((await patch(patchBody({ qaStatus: "PASSED", calibration: { result: "PASSED" } }), params)).status, 409);
  assert.equal((await prisma.promptVersion.findUnique({ where: { id: candidate.id } })).qaStatus, "DRAFT");
  assert.equal((await patch(patchBody({ prompt: "arbitrary replacement" }), params)).status, 409);
  assert.equal((await complete(request({ promptVersionId: candidate.id, result: "PASSED", executedByUserId: admins[0].id }))).status, 400);
  assert.equal((await promote(request(body))).status, 409);
  assert.equal((await patch(patchBody({ status: "ACTIVE" }), params)).status, 409);
  assert.equal((await create(request({ hairstyleId: job.styleId, prompt: "forged", status: "ACTIVE", qaStatus: "PASSED" }))).status, 409);
  await prisma.promptVersion.update({ where: { id: candidate.id }, data: { qaStatus: "PASSED" } }); // Simulates an old unproven row, never an API operation.
  assert.equal((await promote(request(body))).status, 409, "legacy PASSED string is insufficient");
  assert.equal((await patch(patchBody({ status: "ACTIVE" }), params)).status, 409);
  assert.equal((await prisma.promptVersion.findUnique({ where: { id: candidate.id } })).status, "DRAFT");
  console.log("PASS PostgreSQL: direct DRAFT->PASSED, fabricated JSON, creation/activation bypass and legacy PASSED without evidence are rejected.");

  setSession(null);
  assert.equal((await promote(request(body))).status, 401);
  assert.equal((await complete(request({ promptVersionId: candidate.id }))).status, 401);
  assert.equal((await review(request({ attemptId: source.id, reviewerKey: "fake", humanOverallScore: 10 }))).status, 401);
  assert.equal((await handler("app/api/rnd/qa-calibration/route.ts").POST(request({ attemptId: source.id, humanOverallScore: 10 }))).status, 401);
  as(0);
  assert.equal((await complete(request({ promptVersionId: candidate.id }))).status, 200);
  let run = await prisma.rnDPromptCalibration.findFirst({ orderBy: { id: "desc" } });
  assert.equal(run.result, "INCOMPLETE");
  assert.equal((await promote(request(body))).status, 409);
  console.log("PASS PostgreSQL: worker/shared-secret-only completion and rating denied; insufficient calibration records INCOMPLETE and cannot promote.");

  // Twenty distinct synthetic source identities, exact style/prompt; mixed
  // pass/fail controls and three distinct database-backed ADMIN reviewers.
  const samples = [source];
  const reviewImage = handler("app/api/rnd/qa-calibration/review/image/route.ts").GET;
  for (let i = 1; i < 20; i++) {
    const next = await seed("HUMAN_APPROVAL", job.styleId);
    samples.push(await prisma.rnDAttempt.findFirst({ where: { jobId: next.id }, include: { job: { include: { target: true } } } }));
  }
  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i], value = i === 0 ? 9.5 : 8 + i / 10;
    await prisma.rnDAsset.update({ where: { id: sample.job.target.sourceAssetId }, data: { checksum: sha(`synthetic independent source ${i}`) } });
    await prisma.rnDAttempt.update({ where: { id: sample.id }, data: { overallScore: value } });
    for (let j = 0; j < 3; j++) {
      as(j);
      const delivered = await reviewImage(new Request(`https://local-test.invalid/api/rnd/qa-calibration/review/image?attemptId=${sample.id}`));
      assert.equal(delivered.status, 200, "reviewer must receive integrity-checked synthetic image bytes");
      let receiptToken = delivered.headers.get("x-rnd-review-receipt"); assert.ok(receiptToken);
      if (i === 0 && j === 0) {
        as(1);
        assert.equal((await review(request({ attemptId: sample.id, receiptToken, humanOverallScore: value, humanHairstyleScore: value }))).status, 409, "receipt cannot be used by another ADMIN");
        as(0);
        await prisma.rnDQAReviewReceipt.updateMany({ where: { tokenHash: sha(receiptToken), consumedAt: null }, data: { expiresAt: new Date(Date.now() - 1000) } });
        assert.equal((await review(request({ attemptId: sample.id, receiptToken, humanOverallScore: value, humanHairstyleScore: value }))).status, 409, "expired receipt is rejected");
        const refreshed = await reviewImage(new Request("https://local-test.invalid/api/rnd/qa-calibration/review/image?attemptId=" + sample.id));
        assert.equal(refreshed.status, 200); receiptToken = refreshed.headers.get("x-rnd-review-receipt"); assert.ok(receiptToken);
      }
      const r = await review(request({ attemptId: sample.id, receiptToken, humanOverallScore: value, humanHairstyleScore: value, reviewerKey: `caller-forged-${i}-${j}`, reviewedByUserId: admins[3].id }));
      assert.equal(r.status, 201);
      assert.deepEqual(await r.json(), { ok: true }, "blind review must not disclose AI grade or result");
      const replay = await review(request({ attemptId: sample.id, receiptToken, humanOverallScore: value, humanHairstyleScore: value }));
      assert.equal(replay.status, 409, "a review receipt is single-use");
    }
  }
  as(0);
  assert.equal(await prisma.rnDQAReferenceRating.count(), 60);
  assert.equal(await prisma.rnDQAReferenceRating.count({ where: { reviewerKey: { startsWith: "caller-forged" } } }), 0);
  const extraImage = await reviewImage(new Request(`https://local-test.invalid/api/rnd/qa-calibration/review/image?attemptId=${source.id}`));
  assert.equal(extraImage.status, 200);
  const extraReceipt = extraImage.headers.get("x-rnd-review-receipt"); assert.ok(extraReceipt);
  const extraReview = await review(request({ attemptId: source.id, receiptToken: extraReceipt, humanOverallScore: 9.5, humanHairstyleScore: 9.5, reviewerKey: "fourth-fake-identity" }));
  assert.equal(extraReview.status, 409, "same ADMIN cannot submit a second rating even with a fresh image receipt");
  assert.equal(await prisma.rnDQAReferenceRating.count(), 60, "one ADMIN cannot manufacture reviewer quorum using caller keys");
  as(3);
  assert.equal((await complete(request({ promptVersionId: candidate.id }))).status, 200);
  run = await prisma.rnDPromptCalibration.findFirst({ orderBy: { id: "desc" } });
  assert.equal(run.result, "PASSED"); assert.equal(run.promptChecksum, sha(candidate.prompt));
  assert.equal(run.executedByUserId, admins[3].id); assert.equal(run.promptVersionId, candidate.id); assert.equal(run.hairstyleId, job.styleId);
  assert.ok(run.completedAt instanceof Date); assert.equal(run.summary.sampleCount, 20);
  assert.equal(run.summary.status, "HEALTHY"); assert.equal(run.summary.falsePassRate, 0); assert.equal(run.summary.correlation, 1);
  console.log("PASS PostgreSQL: authorized completion computes PASSED from 20 distinct synthetic samples x 3 real DB ADMIN identities; exact candidate/style/hash/time/executor persisted atomically.");

  const { id: _id, ...copy } = run;
  await assert.rejects(prisma.rnDPromptCalibration.delete({ where: { id: run.id } }), /immutable|complete a new execution/i, "calibration execution deletion must be rejected");
  await assert.rejects(prisma.rnDPromptCalibration.update({ where: { id: run.id }, data: { promptChecksum: sha("replacement") } }), /immutable|complete a new execution/i);
  await prisma.rnDPromptCalibration.create({ data: { ...copy, promptChecksum: sha("different prompt") } });
  assert.equal((await promote(request(body))).status, 409, "latest execution for wrong checksum must fail");
  const other = await create(request({ hairstyleId: job.styleId, prompt: candidate.prompt }));
  const otherId = (await other.json()).prompt.id;
  await prisma.rnDPromptCalibration.create({ data: { ...copy, promptVersionId: otherId } });
  assert.equal((await patch(patchBody({ status: "ACTIVE" }), { params: Promise.resolve({ id: otherId }) })).status, 409, "evidence copied to different candidate cannot activate it");
  const otherStyle = await seed();
  await assert.rejects(prisma.rnDPromptCalibration.create({ data: { ...copy, hairstyleId: otherStyle.styleId } }), (e: any) => e.code === "P2003", "wrong candidate/style composite binding rejected by PostgreSQL");
  assert.equal((await promote(request(body))).status, 409, "other candidate evidence cannot repair this candidate");
  assert.equal((await complete(request({ promptVersionId: candidate.id }))).status, 200);

  // A reviewer cannot overwrite an earlier calibration score. The original
  // evidence remains intact; a second submission is a conflict, not a revision.
  as(0);
  const ratingCountBeforeDuplicate = await prisma.rnDQAReferenceRating.count();
  const calibrationCountBeforeDuplicate = await prisma.rnDPromptCalibration.count();
  const duplicateImage = await reviewImage(new Request(`https://local-test.invalid/api/rnd/qa-calibration/review/image?attemptId=${source.id}`));
  assert.equal(duplicateImage.status, 200);
  const duplicateReceipt = duplicateImage.headers.get("x-rnd-review-receipt"); assert.ok(duplicateReceipt);
  assert.equal((await review(request({ attemptId: source.id, receiptToken: duplicateReceipt, humanOverallScore: 9.5, humanHairstyleScore: 9.5 }))).status, 409);
  assert.equal(await prisma.rnDQAReferenceRating.count(), ratingCountBeforeDuplicate);
  assert.equal(await prisma.rnDPromptCalibration.count(), calibrationCountBeforeDuplicate);
  console.log("PASS PostgreSQL: immutable executions, wrong prompt checksum, other candidate/style evidence and duplicate review rejection fail closed.");

  const original = await prisma.rnDAttempt.findUnique({ where: { id: source.id } });
  for (const change of [{ verdict: "FAILED" }, { qaJson: { ...original.qaJson, humanApproval: null } },
    { qaJson: { ...original.qaJson, imageIntegrity: { canvasMatch: true, faceTexturePreservationPass: false } } },
    { qaJson: { ...original.qaJson, imageIntegrity: { canvasMatch: false, faceTexturePreservationPass: true } } },
    { qaJson: { ...original.qaJson, finalVerification: null } }, { qaJson: { ...original.qaJson, overall: 9.49 } }]) {
    await prisma.rnDAttempt.update({ where: { id: source.id }, data: change });
    assert.equal((await promote(request(body))).status, 409, "calibration cannot replace human approval, either integrity gate, final QA or 9.5");
    await prisma.rnDAttempt.update({ where: { id: source.id }, data: { verdict: "APPROVED", qaJson: original.qaJson } });
  }
  assert.equal((await promote(request({ ...body, approved: true, sourceAttemptId: "fabricated" }))).status, 409);
  assert.equal((await promote(request({ ...body, prompt: "replacement" }))).status, 409);
  const responses = await Promise.all([promote(request(body)), promote(request(body))]);
  assert.ok(responses.every(r => r.status === 200));
  assert.deepEqual((await Promise.all(responses.map(r => r.json()))).map(r => r.idempotent).sort(), [false, true]);
  assert.equal((await (await promote(request(body))).json()).idempotent, true);
  assert.equal(await prisma.promptVersion.count({ where: { status: "ACTIVE" } }), 1);
  assert.equal((await prisma.promptVersion.findUnique({ where: { id: otherId } })).status, "DRAFT");
  const drafts = await Promise.all([create(request({ hairstyleId: job.styleId, prompt: "Synthetic draft A" })), create(request({ hairstyleId: job.styleId, prompt: "Synthetic draft B" }))]);
  assert.ok(drafts.every(r => r.status === 201));
  assert.deepEqual((await prisma.promptVersion.findMany({ where: { hairstyleId: job.styleId }, orderBy: { version: "asc" } })).map((p: any) => p.version), [1, 2, 3, 4]);
  console.log("PASS PostgreSQL: legitimate completed calibration promotes only correct candidate; concurrent/repeated promotion idempotent, one ACTIVE, unproven drafts remain non-ACTIVE; original QA/human gates and serialized version allocation preserved.");
  await clean();
  setSession({ user: { id: "local-synthetic-admin", role: "ADMIN" } });
}
