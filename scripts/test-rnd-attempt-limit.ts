import test from "node:test";
import assert from "node:assert/strict";
import { MAX_RND_ATTEMPTS, isRndAttemptAllowed, isRndJobAtAttemptLimit } from "../lib/rnd/attempt-limit";

test("permits attempts 1 through 40 and blocks attempt 41", () => {
  assert.equal(isRndAttemptAllowed(1), true);
  assert.equal(isRndAttemptAllowed(39), true);
  assert.equal(isRndAttemptAllowed(40), true);
  assert.equal(isRndAttemptAllowed(41), false);
  assert.equal(isRndAttemptAllowed(0), false);
  assert.equal(isRndAttemptAllowed(40.5), false);
  assert.equal(MAX_RND_ATTEMPTS, 40);
});

test("jobs at or above the ceiling are terminally ineligible for claims", () => {
  assert.equal(isRndJobAtAttemptLimit(39), false);
  assert.equal(isRndJobAtAttemptLimit(40), true);
  assert.equal(isRndJobAtAttemptLimit(41), true);
  assert.equal(isRndJobAtAttemptLimit(Number.NaN), true);
});
