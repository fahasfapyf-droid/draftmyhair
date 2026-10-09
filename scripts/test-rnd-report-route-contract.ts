import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const route = readFileSync(resolve(process.cwd(), "app/api/rnd/worker/report/route.ts"), "utf8");

test("report route validates the expected attempt before the convergence-limit branch", () => {
  const expectedAttemptCheck = route.indexOf("if (!isExpectedRndAttempt(attemptNumber, job.attemptCount))");
  const attemptLimitCheck = route.indexOf("if (!isRndAttemptAllowed(attemptNumber))");
  assert.notEqual(expectedAttemptCheck, -1);
  assert.notEqual(attemptLimitCheck, -1);
  assert.ok(expectedAttemptCheck < attemptLimitCheck, "unexpected attempt must be rejected before convergence handling");
});

test("convergence transition uses a conditional job-state update before side effects", () => {
  const transition = route.indexOf("const jobTransition = await tx.rnDJob.updateMany({");
  const guard = route.indexOf("if (jobTransition.count !== 1) return false;", transition);
  const attemptSideEffect = route.indexOf("await tx.rnDAttempt.updateMany(", transition);
  const targetSideEffect = route.indexOf("await tx.rnDTarget.update(", transition);
  assert.notEqual(transition, -1);
  assert.notEqual(guard, -1);
  assert.ok(guard < attemptSideEffect, "attempt update must only happen after successful conditional transition");
  assert.ok(guard < targetSideEffect, "target update must only happen after successful conditional transition");
  const predicate = route.slice(transition, guard);
  assert.match(predicate, /status: "PROCESSING"/);
  assert.match(predicate, /leaseOwner: workerId/);
  assert.match(predicate, /attemptCount: \{ gte: MAX_RND_ATTEMPTS \}/);
});

test("preview E2E harness preserves enqueue-only mode before generation", () => {
  const e2e = readFileSync(resolve(process.cwd(), "app/api/rnd/e2e-test/route.ts"), "utf8");
  const enqueue = e2e.indexOf("const enqueue = await invokeEnqueue(sourceBuffer, sourceMime);");
  const enqueueOnly = e2e.indexOf('searchParams.get("enqueueOnly") === "1"');
  const generationLoop = e2e.indexOf("for (let i = 0; i < MAX_ATTEMPTS; i += 1)");
  assert.notEqual(enqueue, -1);
  assert.notEqual(enqueueOnly, -1);
  assert.notEqual(generationLoop, -1);
  assert.ok(enqueue < enqueueOnly && enqueueOnly < generationLoop, "enqueue-only mode must return before any generation attempt");
});
