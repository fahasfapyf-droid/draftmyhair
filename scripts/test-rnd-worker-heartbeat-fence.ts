import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseRndClaimGeneration } from "../lib/rnd/report-lease-fence";

type State = {
  id: string;
  status: string;
  leaseOwner: string;
  leaseExpiresAt: Date;
  startedAt: Date;
};

const now = new Date("2026-10-15T10:03:00.000Z");
const generationA = new Date("2026-10-15T10:00:00.000Z");
const generationB = new Date("2026-10-15T10:02:00.001Z");

function heartbeat(state: State, workerId: string, token: unknown) {
  const generation = parseRndClaimGeneration(token);
  if (!generation || state.status !== "PROCESSING" || state.leaseOwner !== workerId ||
      state.leaseExpiresAt.getTime() <= now.getTime() || state.startedAt.getTime() !== generation.getTime()) return false;
  state.leaseExpiresAt = new Date(now.getTime() + 120_000);
  return true;
}

function stateAtGeneration(generation: Date, owner = "worker-a"): State {
  return {
    id: "job-1",
    status: "PROCESSING",
    leaseOwner: owner,
    leaseExpiresAt: new Date(now.getTime() + 60_000),
    startedAt: generation,
  };
}

function main() {
  const routeSource = readFileSync("app/api/rnd/worker/heartbeat/route.ts", "utf8");
  const workerSource = readFileSync("tools/rnd-worker/worker.ts", "utf8");
  assert.ok(routeSource.includes("const claimGeneration = parseRndClaimGeneration(body?.claimGeneration)"), "heartbeat route must parse the submitted generation");
  assert.ok(routeSource.includes("if (!jobId || !workerId || !claimGeneration)"), "heartbeat route must reject missing or malformed generations before updating");
  assert.ok(routeSource.includes("startedAt: claimGeneration"), "heartbeat update must match the active claim generation");
  assert.ok(routeSource.includes('status: "PROCESSING", leaseOwner: workerId'), "heartbeat must retain status and owner checks");
  assert.ok(routeSource.includes("leaseExpiresAt: { gt: now }"), "heartbeat must reject missing, expired, and boundary-equal lease expirations");
  assert.ok(!routeSource.includes("leaseExpiresAt: null"), "heartbeat must not renew a job whose lease expiry is missing");
  assert.ok(workerSource.includes("body: JSON.stringify({ jobId: job.id, claimGeneration: job.claimGeneration })"), "worker heartbeat must send the claim generation captured on claim");
  assert.ok(workerSource.includes("heartbeatInFlight = heartbeat(job)"), "heartbeat caller must pass the claimed job");

  assert.equal(parseRndClaimGeneration(undefined), null, "missing generation is invalid");
  assert.equal(parseRndClaimGeneration("not-a-timestamp"), null, "malformed generation is invalid");

  const active = stateAtGeneration(generationB);
  assert.equal(heartbeat(active, "worker-a", generationB.toISOString()), true, "the active claim may renew its lease");

  const expiryBoundary = stateAtGeneration(generationB);
  expiryBoundary.leaseExpiresAt = new Date(now);
  const boundaryBefore = structuredClone(expiryBoundary);
  assert.equal(heartbeat(expiryBoundary, "worker-a", generationB.toISOString()), false, "a lease expiring exactly now must not be renewed");
  assert.deepEqual(expiryBoundary, boundaryBefore, "boundary-expired heartbeat must leave state unchanged");

  // Same worker ID after reclaim: A's stale heartbeat must not renew B's lease.
  const reclaimedBySameWorker = stateAtGeneration(generationB, "worker-a");
  const beforeStaleHeartbeat = structuredClone(reclaimedBySameWorker);
  assert.equal(heartbeat(reclaimedBySameWorker, "worker-a", generationA.toISOString()), false, "generation A must be rejected after the same worker reclaims as generation B");
  assert.deepEqual(reclaimedBySameWorker, beforeStaleHeartbeat, "a stale heartbeat must leave the new lease unchanged");

  console.log("R&D worker heartbeat generation-fence checks passed.");
}

main();
