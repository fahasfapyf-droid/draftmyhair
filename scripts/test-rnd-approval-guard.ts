import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const approve = readFileSync("app/api/rnd/approval/approve/route.ts", "utf8");
const reject = readFileSync("app/api/rnd/approval/reject/route.ts", "utf8");

function verifyGuard(source: string, route: "approve" | "reject") {
  assert.match(source, /const session = await auth\(\)/, `${route}: must authenticate the request`);
  assert.match(source, /session\.user\.role !== "ADMIN"/, `${route}: must require an admin`);
  assert.match(source, /if \(job\.status !== "HUMAN_APPROVAL"\)/, `${route}: must reject jobs outside HUMAN_APPROVAL`);
  assert.match(
    source,
    /updateMany\(\{\s*where: \{ id: jobId, status: "HUMAN_APPROVAL" \}/,
    `${route}: state transition must be an atomic compare-and-set`,
  );
  assert.match(source, /if \(claimed\.count !== 1\) return \{ kind: "state" as const, status: "CHANGED" \}/,
    `${route}: losing a concurrent transition must return a conflict`);
  assert.match(source, /result\.kind === "state".*status: 409/,
    `${route}: invalid or already-claimed state must return HTTP 409`);

  const compareAndSet = source.indexOf('where: { id: jobId, status: "HUMAN_APPROVAL" }');
  assert.ok(compareAndSet > -1, `${route}: compare-and-set predicate must exist`);

  if (route === "approve") {
    const promptCreate = source.indexOf("tx.promptVersion.create");
    const targetUpdate = source.indexOf("tx.rnDTarget.update");
    const attemptUpdate = source.indexOf("tx.rnDAttempt.updateMany");
    assert.ok(promptCreate > compareAndSet, "approve: prompt import must occur after the conditional job transition");
    assert.ok(targetUpdate > compareAndSet, "approve: target mutation must occur after the conditional job transition");
    assert.ok(attemptUpdate > compareAndSet, "approve: attempt mutation must occur after the conditional job transition");
    assert.match(source, /status: "COMPLETED", completedAt: new Date\(\)/,
      "approve: job must transition to COMPLETED");
    assert.match(source, /status: "APPROVED"/, "approve: target/attempt approval status must be persisted");
  } else {
    const targetUpdate = source.indexOf("tx.rnDTarget.update");
    const attemptUpdate = source.indexOf("tx.rnDAttempt.updateMany");
    assert.ok(targetUpdate > compareAndSet, "reject: target mutation must occur after the conditional job transition");
    assert.ok(attemptUpdate > compareAndSet, "reject: attempt mutation must occur after the conditional job transition");
    assert.match(source, /status: "FAILED"[\s\S]*failureCode: "HUMAN_REJECTED"/,
      "reject: job must transition to FAILED with HUMAN_REJECTED");
    assert.match(source, /status: "REJECTED"/, "reject: target must transition to REJECTED");
  }
}

verifyGuard(approve, "approve");
verifyGuard(reject, "reject");

console.log("R&D approval/rejection authorization, state guard, atomic compare-and-set, and mutation-order checks passed.");
