import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { transformSync } from "esbuild";
import { parseRndClaimGeneration } from "../lib/rnd/report-lease-fence";

const now = new Date("2026-10-15T10:03:00.000Z");
const generationA = new Date("2026-10-15T10:00:00.000Z");
const generationB = new Date("2026-10-15T10:02:00.001Z");

type State = {
  id: string;
  status: string;
  leaseOwner: string;
  leaseExpiresAt: Date | null;
  startedAt: Date;
  heartbeatAt: Date | null;
};
type Update = {
  where: Pick<State, "id" | "status" | "leaseOwner" | "startedAt"> & { leaseExpiresAt: { gt: Date } };
  data: { leaseExpiresAt: Date; heartbeatAt: Date };
};

const fixedDate = new Proxy(Date, {
  construct: (target, args) => Reflect.construct(target, args.length ? args : [now.getTime()]),
});

function loadHeartbeat(filename: string, dependencies: Record<string, unknown> = {}) {
  const { code } = transformSync(readFileSync(filename, "utf8"), { loader: "ts", format: "cjs", platform: "node" });
  const modules: Record<string, unknown> = {
    "next/server": { NextResponse: Response },
    "@/lib/rnd/worker-auth": {
      requireRndWorker: (authorization: string | null) =>
        authorization === "Bearer fixture" ? null : new Response(null, { status: 401 }),
      RND_WORKER_LEASE_SECONDS: 120,
    },
    ...dependencies,
  };
  const mockRequire = (name: string) => {
    assert.ok(Object.hasOwn(modules, name), "Unexpected heartbeat dependency: " + name);
    return modules[name];
  };
  const mod = { exports: {} };
  new Function("require", "module", "exports", "Date", code)(mockRequire, mod, mod.exports, fixedDate);
  return (mod.exports as { POST: (req: Request) => Promise<Response> }).POST;
}

function request({ path = "worker", authorization, protocol, worker = "worker-a", generation }:
  { path?: string; authorization?: string; protocol?: string; worker?: string; generation?: unknown }) {
  const headers = new Headers({ "content-type": "application/json", "x-rnd-worker-id": worker });
  if (authorization !== undefined) headers.set("authorization", authorization);
  if (protocol !== undefined) headers.set("x-rnd-worker-protocol", protocol);
  return new Request("https://fixture.invalid/api/rnd/" + path + "/heartbeat", {
    method: "POST", headers, body: JSON.stringify({ jobId: "job-1", claimGeneration: generation }),
  });
}

async function testLegacy() {
  // The import allowlist denies Prisma and any other storage dependency.
  const heartbeat = loadHeartbeat("app/api/rnd/agent/heartbeat/route.ts");
  for (const [authorization, protocol, expected] of [
    [undefined, undefined, 401], ["Bearer wrong", "2", 401],
    ["Bearer fixture", undefined, 410], ["Bearer fixture", "1", 410], ["Bearer fixture", "2", 410],
  ] as const) {
    const req = request({ path: "agent", authorization, protocol });
    req.json = () => assert.fail("Retired heartbeat must not parse the request body");
    const response = await heartbeat(req);
    assert.equal(response.status, expected);
    assert.equal(req.bodyUsed, false);
    if (expected === 410) {
      assert.deepEqual(await response.json(), {
        code: "RND_LEGACY_AGENT_HEARTBEAT_DISABLED", replacement: "/api/rnd/worker/heartbeat",
      });
    }
  }
  console.log("PASS handler-mock: legacy heartbeat returns 401/410 without reading the body or accessing storage");
}

async function testCanonical() {
  const active: State = {
    id: "job-1", status: "PROCESSING", leaseOwner: "worker-a", startedAt: generationB,
    leaseExpiresAt: new Date(now.getTime() + 60_000), heartbeatAt: null,
  };
  let state = structuredClone(active);
  let updateCalls = 0;
  const heartbeat = loadHeartbeat("app/api/rnd/worker/heartbeat/route.ts", {
    "@/lib/rnd/report-lease-fence": { parseRndClaimGeneration },
    "@/lib/prisma": { prisma: { rnDJob: { updateMany: async ({ where, data }: Update) => {
      updateCalls++;
      assert.deepEqual(where.leaseExpiresAt, { gt: now });
      if (state.id !== where.id || state.status !== where.status || state.leaseOwner !== where.leaseOwner ||
          state.startedAt.getTime() !== where.startedAt.getTime() ||
          !state.leaseExpiresAt || state.leaseExpiresAt <= where.leaseExpiresAt.gt) return { count: 0 };
      state = { ...state, ...data };
      return { count: 1 };
    } } } },
  });
  assert.equal((await heartbeat(request({ authorization: "Bearer wrong" }))).status, 401);
  const run = (generation: unknown, worker = "worker-a") =>
    heartbeat(request({ authorization: "Bearer fixture", generation, worker }));
  assert.equal((await run(undefined)).status, 400);
  assert.equal((await run("not-a-timestamp")).status, 400);
  assert.equal(updateCalls, 0, "unauthorized or invalid requests cannot reach the database update");

  for (const [overrides, generation, worker] of [
    [{}, generationA, "worker-a"],
    [{}, generationB, "worker-b"],
    [{ status: "QUEUED" }, generationB, "worker-a"],
    [{ leaseExpiresAt: null }, generationB, "worker-a"],
    [{ leaseExpiresAt: new Date(now.getTime() - 1) }, generationB, "worker-a"],
    [{ leaseExpiresAt: now }, generationB, "worker-a"],
  ] as const) {
    state = { ...active, ...overrides };
    const before = structuredClone(state);
    assert.equal((await run(generation.toISOString(), worker)).status, 409);
    assert.deepEqual(state, before, "the rejected heartbeat must leave the active lease unchanged");
  }

  state = structuredClone(active);
  const renewed = await run(generationB.toISOString());
  const leaseExpiresAt = new Date(now.getTime() + 120_000);
  assert.equal(renewed.status, 200);
  assert.deepEqual(await renewed.json(), { ok: true, leaseExpiresAt: leaseExpiresAt.toISOString() });
  assert.deepEqual(state, { ...active, leaseExpiresAt, heartbeatAt: now });
  console.log("PASS handler-mock: canonical heartbeat renews only the current, owned, unexpired processing lease");
}

async function main() {
  const worker = readFileSync("tools/rnd-worker/worker.ts", "utf8");
  assert.ok(worker.includes('api("/api/rnd/worker/heartbeat"'), "worker must use the canonical heartbeat route");
  assert.ok(worker.includes("body: JSON.stringify({ jobId: job.id, claimGeneration: job.claimGeneration })"),
    "worker heartbeat must send the claim generation captured on claim");
  assert.ok(worker.includes("heartbeatInFlight = heartbeat(job)"), "heartbeat caller must pass the claimed job");

  await testLegacy();
  await testCanonical();
}

void main().catch(error => { console.error(error); process.exitCode = 1; });
