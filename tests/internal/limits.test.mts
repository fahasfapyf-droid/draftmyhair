import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  EXPERIMENT_ID_PATTERN,
  InternalOptimizerLimiter,
  readInternalLimitsConfig,
  requireExperimentId,
} from "../../lib/internal/limits.ts";

// Isolated configs per protection axis so tests can't trip a different gate.
const QUOTA = { maxPerExperiment: 2, maxConcurrent: 100, rateLimitPerMinute: 1000 };
const CONCURRENCY = { maxPerExperiment: 1000, maxConcurrent: 1, rateLimitPerMinute: 1000 };
const RATE = { maxPerExperiment: 1000, maxConcurrent: 1000, rateLimitPerMinute: 2 };

describe("internal optimizer abuse protection (limits)", () => {
  it("enforces the maximum generations per experiment (quota)", () => {
    const limiter = new InternalOptimizerLimiter(QUOTA);
    assert.equal(
      limiter.tryStart("exp-1", "11111111-1111-4111-8111-111111111111").ok,
      true
    );
    assert.equal(
      limiter.tryStart("exp-1", "22222222-2222-4222-8222-222222222222").ok,
      true
    );
    const third = limiter.tryStart(
      "exp-1",
      "33333333-3333-4333-8333-333333333333"
    );
    assert.equal(third.ok, false);
    assert.equal((third as { status: number }).status, 429);
    assert.match((third as { reason: string }).reason, /quota/i);

    // A different experiment is unaffected.
    assert.equal(
      limiter.tryStart("exp-2", "44444444-4444-4444-8444-444444444444").ok,
      true
    );
  });

  it("enforces the maximum concurrent optimizer generations", () => {
    const limiter = new InternalOptimizerLimiter(CONCURRENCY);
    const g1 = "11111111-1111-4111-8111-111111111111";
    const g2 = "22222222-2222-4222-8222-222222222222";
    assert.equal(limiter.tryStart("exp-c", g1).ok, true);

    const second = limiter.tryStart("exp-c", g2);
    assert.equal(second.ok, false);
    assert.match((second as { reason: string }).reason, /concurrent/i);

    limiter.finish(g1);
    assert.equal(limiter.tryStart("exp-c", g2).ok, true);
  });

  it("enforces the rate limit (per minute)", () => {
    const limiter = new InternalOptimizerLimiter(RATE); // 2/min
    const mk = (n: number) =>
      `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
    assert.equal(limiter.tryStart("exp-r", mk(1)).ok, true);
    assert.equal(limiter.tryStart("exp-r", mk(2)).ok, true);

    const third = limiter.tryStart("exp-r", mk(3));
    assert.equal(third.ok, false);
    assert.equal((third as { status: number }).status, 429);
    assert.match((third as { reason: string }).reason, /rate limit/i);
  });

  it("fails closed on an invalid experiment id", () => {
    const limiter = new InternalOptimizerLimiter(QUOTA);
    assert.equal(EXPERIMENT_ID_PATTERN.test("valid_experiment-1.2"), true);

    const bad = limiter.tryStart(
      "bad id!",
      "11111111-1111-4111-8111-111111111111"
    );
    assert.equal(bad.ok, false);
    assert.equal((bad as { status: number }).status, 400);
  });

  it("reads limits from environment (stricter in tests), with safe fallbacks", () => {
    const env = {
      DMH_INTERNAL_MAX_PER_EXPERIMENT: "5",
      DMH_INTERNAL_MAX_CONCURRENT: "2",
      DMH_INTERNAL_RATE_LIMIT_PER_MINUTE: "3",
    };
    const config = readInternalLimitsConfig(env);
    assert.deepEqual(config, {
      maxPerExperiment: 5,
      maxConcurrent: 2,
      rateLimitPerMinute: 3,
    });

    const defaults = readInternalLimitsConfig({});
    assert.equal(defaults.maxPerExperiment, 200);
    assert.equal(defaults.maxConcurrent, 8);
    assert.equal(defaults.rateLimitPerMinute, 30);

    // Malformed values fall back to defaults instead of failing open.
    const malformed = readInternalLimitsConfig({
      DMH_INTERNAL_MAX_PER_EXPERIMENT: "abc",
      DMH_INTERNAL_MAX_CONCURRENT: "-3",
    });
    assert.equal(malformed.maxPerExperiment, 200);
    assert.equal(malformed.maxConcurrent, 8);
  });
});

describe("internal optimizer experiment id validation", () => {
  it("accepts a valid experiment id", () => {
    const result = requireExperimentId("dmh-lab-1-7");
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.value, "dmh-lab-1-7");
  });

  it("rejects a missing experiment id (fail closed)", () => {
    const result = requireExperimentId(null);
    assert.equal(result.ok, false);
    assert.equal((result as { status: number }).status, 400);
    assert.match((result as { reason: string }).reason, /required/i);
  });

  it("rejects an invalid experiment id (fail closed)", () => {
    const result = requireExperimentId("bad id!");
    assert.equal(result.ok, false);
    assert.equal((result as { status: number }).status, 400);
  });
});
