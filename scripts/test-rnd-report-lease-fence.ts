import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fenceRndReportLease, hasValidRndLeaseExpiry, validateRndClaimGeneration } from "../lib/rnd/report-lease-fence";

const initialStartedAt = new Date("2026-10-15T10:00:00.000Z");
const initialLeaseExpiresAt = new Date("2026-10-15T10:02:00.000Z");
const initialNow = new Date("2026-10-15T10:01:00.000Z");
const leaseDurationMs = 120_000;

type State = {
  job: { id: string; status: string; leaseOwner: string; leaseExpiresAt: Date; startedAt: Date; attemptCount: number; heartbeatAt: Date };
  attempt: { id: string; jobId: string; attemptNumber: number; verdict: string };
  target: { status: string };
};

function makeState(owner: string): State {
  return {
    job: { id: "job-1", status: "PROCESSING", leaseOwner: owner, leaseExpiresAt: initialLeaseExpiresAt, startedAt: initialStartedAt, attemptCount: 0, heartbeatAt: initialStartedAt },
    attempt: { id: "attempt-1", jobId: "job-1", attemptNumber: 1, verdict: "REFINE" },
    target: { status: "PROCESSING" },
  };
}

function makeTx(state: State, databaseNow: () => Date) {
  return {
    async $queryRaw<T>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T> {
      assert.match(strings.join("?"), /startedAt/);
      assert.match(strings.join("?"), /clock_timestamp\(\)/);
      const [jobId, workerId, claimStartedAt, expectedAttemptCount, attemptId, attemptNumber] = values;
      const matches = state.job.id === jobId &&
        state.job.status === "PROCESSING" &&
        state.job.leaseOwner === workerId &&
        state.job.leaseExpiresAt > databaseNow() &&
        state.job.startedAt.getTime() === (claimStartedAt as Date).getTime() &&
        state.job.attemptCount === expectedAttemptCount &&
        state.attempt.id === attemptId &&
        state.attempt.jobId === state.job.id &&
        state.attempt.attemptNumber === attemptNumber;
      if (!matches) return [] as T;
      state.job.heartbeatAt = databaseNow();
      return [{ id: state.job.id }] as T;
    },
  };
}

async function staleReportAfterReclaim(reclaimedOwner: string) {
  const state = makeState("worker-a");
  let databaseNow = new Date(initialNow);
  const fence = {
    jobId: state.job.id,
    workerId: "worker-a",
    claimStartedAt: state.job.startedAt,
    expectedAttemptCount: 0,
    attemptId: state.attempt.id,
    attemptNumber: 1,
  };

  // Worker A passes the route's initial lease checks before its mocked QA pauses.
  assert.equal(state.job.status, "PROCESSING");
  assert.equal(state.job.leaseOwner, fence.workerId);
  assert.ok(state.job.leaseExpiresAt > databaseNow, "A begins with a valid lease");
  assert.equal(state.job.attemptCount + 1, fence.attemptNumber);

  let resumeQa!: () => void;
  const qaPaused = new Promise<void>((resolve) => { resumeQa = resolve; });
  const report = (async () => {
    await qaPaused;
    const fenced = await fenceRndReportLease(makeTx(state, () => databaseNow), fence);
    if (fenced) {
      state.attempt.verdict = "HUMAN_APPROVAL";
      state.job.status = "HUMAN_APPROVAL";
      state.target.status = "HUMAN_APPROVAL";
    }
    return fenced;
  })();

  // Expire A's lease, then model claim/route eligibility and its atomic claim update.
  databaseNow = new Date(state.job.leaseExpiresAt.getTime() + 1);
  assert.ok(databaseNow > initialNow, "mocked database time advances while QA is paused");
  assert.equal(state.job.status, "PROCESSING");
  assert.ok(state.job.leaseExpiresAt < databaseNow, "PROCESSING job is eligible for lease recovery");
  const previousGeneration = state.job.startedAt;
  const previousAttemptId = state.attempt.id;
  const reclaimed = state.job.status === "PROCESSING" && state.job.leaseExpiresAt < databaseNow;
  assert.equal(reclaimed, true, "B must only reclaim an expired PROCESSING lease");
  if (reclaimed) {
    state.job.leaseOwner = reclaimedOwner;
    state.job.startedAt = new Date(Math.max(databaseNow.getTime(), previousGeneration.getTime() + 1));
    state.job.leaseExpiresAt = new Date(databaseNow.getTime() + leaseDurationMs);
    state.job.heartbeatAt = databaseNow;
    // The claim route reuses the existing reservation for this attempt number.
    assert.equal(state.attempt.id, previousAttemptId);
  }
  assert.ok(state.job.leaseExpiresAt > databaseNow, "B receives a valid lease");
  assert.ok(state.job.startedAt > previousGeneration, "B receives a newer claim generation");
  assert.equal(state.job.leaseOwner, reclaimedOwner);
  const reclaimedState = structuredClone(state);
  resumeQa();

  assert.equal(await report, false, "stale report must fail its atomic claim-generation fence");
  assert.deepEqual(state, reclaimedState, "rejected report must leave B's job, lease, attempt, target, and heartbeat unchanged");
}

function reclaimExpiredLease(state: State, reclaimedOwner: string, databaseNow: Date) {
  if (state.job.status !== "PROCESSING" || state.job.leaseExpiresAt >= databaseNow) return false;
  const previousGeneration = state.job.startedAt;
  state.job.leaseOwner = reclaimedOwner;
  state.job.startedAt = new Date(Math.max(databaseNow.getTime(), previousGeneration.getTime() + 1));
  state.job.leaseExpiresAt = new Date(databaseNow.getTime() + leaseDurationMs);
  state.job.heartbeatAt = databaseNow;
  return true;
}

async function staleReportArrivingAfterReclaim(reclaimedOwner: string) {
  const state = makeState("worker-a");
  const generationA = state.job.startedAt.toISOString();
  let databaseNow = new Date(initialNow);
  assert.ok(state.job.leaseExpiresAt > databaseNow, "A claims while its lease is valid");

  databaseNow = new Date(state.job.leaseExpiresAt.getTime() + 1);
  assert.equal(reclaimExpiredLease(state, reclaimedOwner, databaseNow), true, "B reclaims only after A's lease expires");
  assert.ok(state.job.leaseExpiresAt > databaseNow, "B's new lease is valid");
  assert.notEqual(state.job.startedAt.toISOString(), generationA, "B's generation differs from A's");
  const stateBeforeStaleReport = structuredClone(state);

  let qaStarted = false;
  const generationCheck = validateRndClaimGeneration(generationA, state.job.startedAt);
  if (generationCheck.status === "valid") qaStarted = true;

  assert.equal(generationCheck.status, "stale", "a late report carrying A's token must be rejected");
  assert.equal(qaStarted, false, "stale report must be rejected before QA");
  assert.deepEqual(state, stateBeforeStaleReport, "stale late report must not mutate any state");
}

function rejectsBeforeQa(state: State, generation: unknown) {
  const before = structuredClone(state);
  let qaStarted = false;
  const result = validateRndClaimGeneration(generation, state.job.startedAt);
  if (result.status === "valid") qaStarted = true;
  assert.deepEqual(state, before, "invalid or missing generation must not mutate state");
  return { result, qaStarted };
}

function rejectsInvalidLeaseBeforeQa(leaseExpiresAt: unknown, now: Date) {
  return hasValidRndLeaseExpiry(leaseExpiresAt, now);
}

async function main() {
  const reportSource = readFileSync("app/api/rnd/worker/report/route.ts", "utf8");
  const artifactSource = readFileSync("app/api/rnd/worker/artifacts/route.ts", "utf8");
  const heartbeatSource = readFileSync("app/api/rnd/worker/heartbeat/route.ts", "utf8");
  const earlyLeaseCheck = reportSource.indexOf("!hasValidRndLeaseExpiry(job.leaseExpiresAt, leaseValidationTime)");
  const hindsightRecall = reportSource.indexOf("const hindsightHistory = await recallRndHistory");
  assert.ok(earlyLeaseCheck >= 0, "report route must reject missing, invalid, and expired leases in its early validation");
  assert.ok(hindsightRecall > earlyLeaseCheck, "lease validation must happen before Hindsight recall and QA processing");
  assert.ok(artifactSource.includes("!hasValidRndLeaseExpiry(job.leaseExpiresAt, now)"), "artifact route must reject missing, invalid, and expired leases before upload");
  assert.ok(heartbeatSource.includes("leaseExpiresAt: { gt: now }"), "heartbeat must only renew a strictly unexpired lease");
  assert.ok(!heartbeatSource.includes("leaseExpiresAt: null"), "heartbeat must not renew a missing lease expiry");

  const leaseNow = new Date("2026-10-15T10:01:00.000Z");
  assert.equal(rejectsInvalidLeaseBeforeQa(null, leaseNow), false, "null lease expiry must not reach QA");
  assert.equal(rejectsInvalidLeaseBeforeQa(undefined, leaseNow), false, "missing lease expiry must not reach QA");
  assert.equal(rejectsInvalidLeaseBeforeQa(new Date(Number.NaN), leaseNow), false, "invalid Date lease expiry must not reach QA");
  assert.equal(rejectsInvalidLeaseBeforeQa(new Date(leaseNow.getTime() - 1), leaseNow), false, "expired lease must not reach QA");
  assert.equal(rejectsInvalidLeaseBeforeQa(new Date(leaseNow.getTime()), leaseNow), false, "lease expiring exactly now must not reach QA");
  assert.equal(rejectsInvalidLeaseBeforeQa(new Date(leaseNow.getTime() + 1), leaseNow), true, "valid unexpired lease may proceed to QA");
  assert.equal(rejectsInvalidLeaseBeforeQa(new Date(leaseNow.getTime() + 1), new Date(Number.NaN)), false, "invalid validation time must fail closed");

  await staleReportAfterReclaim("worker-b");
  await staleReportAfterReclaim("worker-a");
  await staleReportArrivingAfterReclaim("worker-b");
  await staleReportArrivingAfterReclaim("worker-a");

  const currentState = makeState("worker-b");
  const databaseNow = new Date(initialNow);
  currentState.job.startedAt = new Date(initialStartedAt.getTime() + 1);
  currentState.job.leaseExpiresAt = new Date(databaseNow.getTime() + leaseDurationMs);
  const currentGeneration = currentState.job.startedAt.toISOString();
  const currentCheck = validateRndClaimGeneration(currentGeneration, currentState.job.startedAt);
  assert.equal(currentCheck.status, "valid", "B's current generation must pass initial validation");
  if (currentCheck.status === "valid") {
    assert.equal(await fenceRndReportLease(makeTx(currentState, () => databaseNow), {
      jobId: currentState.job.id,
      workerId: "worker-b",
      claimStartedAt: currentCheck.generation,
      expectedAttemptCount: 0,
      attemptId: currentState.attempt.id,
      attemptNumber: 1,
    }), true, "B's current generation must pass the final fence when lease conditions hold");
  }

  const missingGeneration = rejectsBeforeQa(currentState, undefined);
  assert.equal(missingGeneration.result.status, "invalid");
  assert.equal(missingGeneration.qaStarted, false, "missing generation must be rejected before QA");
  const malformedGeneration = rejectsBeforeQa(currentState, "not-a-timestamp");
  assert.equal(malformedGeneration.result.status, "invalid");
  assert.equal(malformedGeneration.qaStarted, false, "malformed generation must be rejected before QA");

  const activeState = makeState("worker-a");
  const activeFence = {
    jobId: activeState.job.id,
    workerId: "worker-a",
    claimStartedAt: activeState.job.startedAt,
    expectedAttemptCount: 0,
    attemptId: activeState.attempt.id,
    attemptNumber: 1,
  };
  assert.equal(await fenceRndReportLease(makeTx(activeState, () => initialNow), activeFence), true, "heartbeat updates must not invalidate the active claim generation");
  assert.equal(activeState.job.startedAt.getTime(), initialStartedAt.getTime());

  // Regression guard for the QA infrastructure retry policy. The retry counter
  // must be incremented only after the report lease fence, against the exact
  // reserved attempt, and must stop requeueing after three retries.
  const retryReportSource = readFileSync("app/api/rnd/worker/report/route.ts", "utf8");
  const infrastructureBranchStart = retryReportSource.indexOf("if (retryableInfrastructureFailure)");
  const infrastructureBranchEnd = retryReportSource.indexOf('return NextResponse.json({ error: message }, { status: 503 });', infrastructureBranchStart);
  assert.ok(infrastructureBranchStart >= 0 && infrastructureBranchEnd > infrastructureBranchStart, "QA infrastructure retry branch must exist");
  const infrastructureBranch = retryReportSource.slice(infrastructureBranchStart, infrastructureBranchEnd);
  const infrastructureFencePosition = infrastructureBranch.indexOf("fenceRndReportLease(tx, reportFence)");
  const infrastructureCounterPosition = infrastructureBranch.indexOf('SET "infrastructureRetryCount" = "infrastructureRetryCount" + 1');
  assert.ok(infrastructureFencePosition >= 0, "infrastructure retry must use the report lease fence");
  assert.ok(infrastructureCounterPosition > infrastructureFencePosition, "counter increments only after the lease fence");
  assert.match(infrastructureBranch, /WHERE "id" = \$\{reservation\.id\}[\s\S]*AND "jobId" = \$\{jobId\}[\s\S]*AND "attemptNumber" = \$\{attemptNumber\}/, "counter update must target the exact attempt reservation");
  assert.match(infrastructureBranch, /if \(retryRows\.length !== 1\)/, "missing retry-counter row must abort the transaction");
  assert.match(retryReportSource, /const MAX_RND_INFRASTRUCTURE_RETRIES = 3;/, "infrastructure retry ceiling must be explicit");
  assert.match(infrastructureBranch, /infrastructureRetryCount > MAX_RND_INFRASTRUCTURE_RETRIES/, "limit must be checked after increment");
  assert.match(infrastructureBranch, /action: "INFRASTRUCTURE_RETRY_LIMIT_REACHED"/, "exhaustion response must be explicit");
  assert.match(infrastructureBranch, /action: "RETRY_QA_INFRASTRUCTURE"/, "retry response must be explicit");

  const retryTransition = (previousCount: number) => {
    const infrastructureRetryCount = previousCount + 1;
    return { infrastructureRetryCount, status: infrastructureRetryCount > 3 ? "FAILED" : "QUEUED" };
  };
  assert.deepEqual(retryTransition(0), { infrastructureRetryCount: 1, status: "QUEUED" });
  assert.deepEqual(retryTransition(1), { infrastructureRetryCount: 2, status: "QUEUED" });
  assert.deepEqual(retryTransition(2), { infrastructureRetryCount: 3, status: "QUEUED" });
  assert.deepEqual(retryTransition(3), { infrastructureRetryCount: 4, status: "FAILED" }, "fourth infrastructure failure exhausts the three-retry allowance");

  console.log("R&D report lease fence and infrastructure retry-limit regression checks passed.");
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
