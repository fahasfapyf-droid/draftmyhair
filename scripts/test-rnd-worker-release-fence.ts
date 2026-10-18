import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const generationA = new Date("2026-10-15T10:00:00.000Z");
const generationB = new Date("2026-10-15T10:02:00.001Z");
const now = new Date("2026-10-15T10:03:00.000Z");

type State = {
  job: {
    id: string;
    status: string;
    leaseOwner: string | null;
    leaseExpiresAt: Date | null;
    startedAt: Date;
    heartbeatAt: Date | null;
  };
  target: { status: string; currentJobId: string };
  attempt: { id: string; verdict: string };
};

function makeState(owner: string, generation = generationA): State {
  return {
    job: {
      id: "job-1",
      status: "PROCESSING",
      leaseOwner: owner,
      leaseExpiresAt: new Date("2026-10-15T10:04:00.000Z"),
      startedAt: generation,
      heartbeatAt: generation,
    },
    target: { status: "PROCESSING", currentJobId: "job-1" },
    attempt: { id: "attempt-1", verdict: "REFINE" },
  };
}

function parseGeneration(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString() !== value ? null : parsed;
}

// In-memory model of the conditional UPDATE predicate and same-transaction target write.
// The route source assertions below tie the modeled predicates to the production query.
function release(state: State, workerId: string, submittedGeneration: unknown) {
  const generation = parseGeneration(submittedGeneration);
  if (!generation) return false;
  if (
    state.job.id !== "job-1" ||
    state.job.status !== "PROCESSING" ||
    state.job.leaseOwner !== workerId ||
    !(state.job.leaseExpiresAt instanceof Date) ||
    !Number.isFinite(state.job.leaseExpiresAt.getTime()) ||
    state.job.leaseExpiresAt.getTime() <= now.getTime() ||
    state.job.startedAt.getTime() !== generation.getTime()
  ) return false;

  // Expiry alone does not authorize an old release. If no reclaim occurred, the
  // matching generation still identifies this claim; a reclaim changes startedAt.
  state.job.status = "QUEUED";
  state.job.leaseOwner = null;
  state.job.leaseExpiresAt = null;
  state.job.heartbeatAt = null;
  state.target.status = "QUEUED";
  return true;
}

function assertRejectedWithoutMutation(state: State, workerId: string, token: unknown, message: string) {
  const before = structuredClone(state);
  assert.equal(release(state, workerId, token), false, message);
  assert.deepEqual(state, before, `${message}: no job, lease, heartbeat, attempt, or target mutation`);
}

function main() {
  const releaseSource = readFileSync("app/api/rnd/worker/release/route.ts", "utf8");
  const workerSource = readFileSync("tools/rnd-worker/worker.ts", "utf8");
  assert.ok(releaseSource.includes("parseRndClaimGeneration(body?.claimGeneration)"), "release route must use the shared canonical claim-generation parser");
  assert.ok(releaseSource.includes('AND job."status" = \'PROCESSING\''), "release SQL must condition on PROCESSING");
  assert.ok(releaseSource.includes('AND job."leaseOwner" = ${workerId}'), "release SQL must condition on lease owner");
  assert.ok(releaseSource.includes('AND job."startedAt" = ${claimGeneration}'), "release SQL must condition on the submitted claim generation");
  assert.ok(releaseSource.includes('AND job."leaseExpiresAt" > clock_timestamp()'), "release SQL must reject missing, invalid, and expired lease expirations");
  assert.ok(releaseSource.includes('RETURNING job."id", job."targetId"'), "release SQL must return the target from the same conditional update");
  assert.ok(releaseSource.includes("await tx.rnDTarget.update"), "target release must be part of the transaction");
  assert.ok(workerSource.includes("body: JSON.stringify({ jobId: job.id, claimGeneration: job.claimGeneration })"), "worker release must send the generation captured on its claim");
  assert.equal((workerSource.match(/release\(result\.job\)/g) ?? []).length, 2, "both main-loop release call sites must pass the claimed job");
  assert.ok(workerSource.includes("release(job).catch"), "source-download release must use the claimed job");

  const current = makeState("worker-a");
  const attemptBefore = structuredClone(current.attempt);
  assert.equal(release(current, "worker-a", generationA.toISOString()), true, "current generation release succeeds");
  assert.equal(current.job.status, "QUEUED");
  assert.equal(current.job.leaseOwner, null);
  assert.equal(current.job.leaseExpiresAt, null);
  assert.equal(current.job.heartbeatAt, null);
  assert.equal(current.target.status, "QUEUED");
  assert.deepEqual(current.attempt, attemptBefore, "release must not mutate the attempt");

  const differentOwner = makeState("worker-b");
  assertRejectedWithoutMutation(differentOwner, "worker-a", generationA.toISOString(), "different worker ID is rejected");

  const missing = makeState("worker-a");
  assertRejectedWithoutMutation(missing, "worker-a", undefined, "missing generation is rejected");
  const malformed = makeState("worker-a");
  assertRejectedWithoutMutation(malformed, "worker-a", "not-a-timestamp", "malformed generation is rejected");
  const nonCanonical = makeState("worker-a");
  assertRejectedWithoutMutation(nonCanonical, "worker-a", "2026-10-15T10:00:00Z", "non-canonical generation is rejected");

  for (const reclaimedOwner of ["worker-b", "worker-a"]) {
    const reclaimed = makeState(reclaimedOwner);
    reclaimed.job.leaseExpiresAt = new Date(generationA.getTime() + 1);
    assert.ok(reclaimed.job.leaseExpiresAt < now, "A's lease is expired before reclaim");
    reclaimed.job.startedAt = generationB;
    reclaimed.job.leaseExpiresAt = new Date(now.getTime() + 120_000);
    reclaimed.job.heartbeatAt = now;
    const beforeStaleRelease = structuredClone(reclaimed);
    assertRejectedWithoutMutation(reclaimed, "worker-a", generationA.toISOString(), `old generation cannot release reclaimed lease for ${reclaimedOwner}`);
    assert.deepEqual(reclaimed, beforeStaleRelease);
  }

  const expiredButNotReclaimed = makeState("worker-a");
  expiredButNotReclaimed.job.leaseExpiresAt = new Date(now.getTime() - 1);
  assertRejectedWithoutMutation(expiredButNotReclaimed, "worker-a", generationA.toISOString(), "expired lease cannot be released by a worker");

  const missingLeaseExpiry = makeState("worker-a");
  missingLeaseExpiry.job.leaseExpiresAt = null;
  assertRejectedWithoutMutation(missingLeaseExpiry, "worker-a", generationA.toISOString(), "missing lease expiry is rejected");

  const invalidLeaseExpiry = makeState("worker-a");
  invalidLeaseExpiry.job.leaseExpiresAt = new Date(Number.NaN);
  assertRejectedWithoutMutation(invalidLeaseExpiry, "worker-a", generationA.toISOString(), "invalid lease expiry is rejected");

  const boundaryLeaseExpiry = makeState("worker-a");
  boundaryLeaseExpiry.job.leaseExpiresAt = new Date(now);
  assertRejectedWithoutMutation(boundaryLeaseExpiry, "worker-a", generationA.toISOString(), "lease expiring exactly now is rejected");

  console.log("R&D worker release generation-fence checks passed.");
}

main();
