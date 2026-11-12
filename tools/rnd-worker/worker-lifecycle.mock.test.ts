/**
 * Exercises the production main loop with injected browser, API and process mocks.
 * Never imports the worker entry point or launches a worker/browser.
 */
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import { transformSync } from "esbuild";

const source = readFileSync("tools/rnd-worker/worker.ts", "utf8");
const configCode = transformSync(source.slice(source.indexOf("const API_BASE"), source.indexOf("const WORKER_TOKEN")), { loader: "ts" }).code;
const validateTarget = (env: Record<string, string>) => new Function("process", configCode + "\nreturn API_BASE;")({ env });
assert.throws(() => validateTarget({}), /explicitly select/);
assert.equal(validateTarget({ RND_API_BASE_URL: "https://draftmyhair-fixture-draftmyhair.vercel.app" }), "https://draftmyhair-fixture-draftmyhair.vercel.app");
for (const value of ["https://draftmyhair.com", "https://draftmyhair.vercel.app", "https://fixture.invalid/path", "https://user:pass@fixture.invalid", "http://127.0.0.1:3000"]) assert.throws(() => validateTarget({ RND_API_BASE_URL: value }));
assert.equal(validateTarget({ RND_API_BASE_URL: "http://127.0.0.1:3000", RND_ALLOW_LOCAL_API: "1" }), "http://127.0.0.1:3000");
const start = source.indexOf("async function main() {");
const end = source.indexOf("main().catch(", start);
assert.ok(start >= 0 && end > start);
const mainCode = transformSync(source.slice(start, end), { loader: "ts" }).code;

function signal() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}

async function bounded(promise: Promise<void>) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([promise, new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => reject(new Error("Mock worker lifecycle did not reach the expected boundary")), 2000);
    })]);
  } finally {
    clearTimeout(timer);
  }
}

class MockPage extends EventEmitter {
  closed = false;
  isClosed() { return this.closed; }
  close() { this.closed = true; this.emit("close"); }
}

function startMain(outcome: "CONTINUE" | "RECONCILE", pauseProcessing = false, disconnectDuringProcessing = false) {
  const waiting = signal(), processing = signal(), finishProcessing = signal();
  const events = new EventEmitter();
  const page = new MockPage();
  const state = { claims: 0, closes: 0, statuses: [] as string[], logs: [] as string[] };
  const context = { close: async () => { state.closes++; } };
  const deps = {
    process: events,
    console: {
      log: (message: string) => state.logs.push(message),
      error: (message: string) => {
        state.logs.push(message);
        if (message.startsWith("Awaiting operator reconciliation.")) waiting.resolve();
      },
    },
    mkdir: async () => {}, OUTPUT_DIR: "mock-output",
    workerId: async () => "fixture-worker", API_BASE: "https://fixture.invalid",
    assertServer: async () => {},
    selectGeminiProfile: async () => ({ id: "fixture-profile", label: "fixture" }),
    reportWorkerStatus: async (status = "ONLINE") => { state.statuses.push(status); },
    setInterval: () => 1, clearInterval: () => {}, STATUS_HEARTBEAT_MS: 15000,
    RUN_ONCE: true, POLL_MS: 1,
    launchGeminiSession: async () => ({ context, page }),
    claim: async () => { state.claims++; return { job: { id: "fixture-job", attemptNumber: 3 } }; },
    release: async () => assert.fail("An uncertain attempt must not be released"),
    processJob: async () => {
      processing.resolve();
      if (pauseProcessing) await finishProcessing.promise;
      if (disconnectDuringProcessing) page.closed = true;
      return outcome;
    },
  };
  const main = new Function(...Object.keys(deps),
    "let geminiProfileForStatus;\n" + mainCode + "\nreturn main;")(...Object.values(deps)) as () => Promise<void>;
  const done = main();
  return { done, waiting, processing, finishProcessing, events, page, state };
}

async function main() {
  for (const acknowledgement of ["signal", "close"] as const) {
    const run = startMain("RECONCILE");
    await bounded(run.waiting.promise);
    assert.equal(run.state.claims, 1);
    assert.equal(run.state.closes, 0, "uncertainty must retain the worker-owned browser");
    assert.equal(run.state.statuses.at(-1), "STOPPED");
    if (acknowledgement === "signal") run.events.emit("SIGINT");
    else run.page.close();
    await bounded(run.done);
    assert.equal(run.state.closes, 1);
    assert.equal(run.state.claims, 1, "one-shot reconciliation cannot claim a second job");
    assert.equal(run.events.listenerCount("SIGINT"), 0);
    assert.equal(run.page.listenerCount("close"), 0);
  }

  const completed = startMain("CONTINUE", true);
  await bounded(completed.processing.promise);
  completed.events.emit("SIGINT");
  assert.equal(completed.state.closes, 0, "shutdown during capture must wait for processing");
  completed.finishProcessing.resolve();
  await bounded(completed.done);
  assert.equal(completed.state.closes, 1);
  assert.equal(completed.state.claims, 1);

  const interrupted = startMain("RECONCILE", true);
  await bounded(interrupted.processing.promise);
  interrupted.events.emit("SIGINT");
  interrupted.finishProcessing.resolve();
  await bounded(interrupted.waiting.promise);
  assert.equal(interrupted.state.closes, 0, "an earlier stop request does not acknowledge an uncertain submission");
  interrupted.events.emit("SIGINT");
  await bounded(interrupted.done);
  assert.equal(interrupted.state.closes, 1);
  assert.equal(interrupted.state.claims, 1);

  const disconnected = startMain("RECONCILE", false, true);
  await bounded(disconnected.done);
  assert.equal(disconnected.state.claims, 1);
  assert.equal(disconnected.state.closes, 1);

  console.log("PASS mocked worker lifecycle: uncertainty retains the browser until acknowledgement; completion and one-shot shutdown claim at most one job.");
}

void main().catch(error => { console.error(error); process.exitCode = 1; });
