import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import {
  isExpectedRndAttempt,
  isRndAttemptAllowed,
  isRndJobAtAttemptLimit,
  MAX_RND_ATTEMPTS,
} from "../lib/rnd/attempt-limit";

test("the final allowed attempt is accepted and the next attempt is rejected", () => {
  assert.equal(MAX_RND_ATTEMPTS, 40);
  assert.equal(isRndAttemptAllowed(1), true);
  assert.equal(isRndAttemptAllowed(MAX_RND_ATTEMPTS), true);
  assert.equal(isRndAttemptAllowed(MAX_RND_ATTEMPTS + 1), false);
  assert.equal(isRndAttemptAllowed(0), false);
  assert.equal(isRndAttemptAllowed(1.5), false);
});

test("attempt reports must match the next one-based attempt number", () => {
  assert.equal(isExpectedRndAttempt(1, 0), true);
  assert.equal(isExpectedRndAttempt(40, 39), true);
  assert.equal(isExpectedRndAttempt(41, 40), true);
  assert.equal(isExpectedRndAttempt(40, 40), false);
  assert.equal(isExpectedRndAttempt(1.5, 0), false);
});

test("jobs at or beyond the attempt ceiling are terminalization candidates", () => {
  assert.equal(isRndJobAtAttemptLimit(39), false);
  assert.equal(isRndJobAtAttemptLimit(40), true);
  assert.equal(isRndJobAtAttemptLimit(41), true);
  assert.equal(isRndJobAtAttemptLimit(Number.NaN), true);
});

test("report and claim paths terminalize exhausted work rather than enqueue attempt 41", async () => {
  const report = await readFile("app/api/rnd/worker/report/route.ts", "utf8");
  const claim = await readFile("app/api/rnd/worker/claim/route.ts", "utf8");

  assert.match(report, /isRndJobAtAttemptLimit\(attemptNumber\)/);
  assert.match(report, /status: "EXHAUSTED"/);
  assert.match(report, /action: "EXHAUSTED"/);
  assert.match(claim, /attemptCount: \{ lt: MAX_RND_ATTEMPTS \}/);
  assert.match(claim, /status: "EXHAUSTED"/);
});

test("enum migration maps legacy HUMAN_REVIEW values before dropping old enum types", async () => {
  const migration = await readFile(
    "prisma/migrations/20261010090000_normalize_rnd_human_review_enums/migration.sql",
    "utf8",
  );

  assert.equal((migration.match(/WHEN 'HUMAN_REVIEW' THEN 'HUMAN_APPROVAL'/g) ?? []).length, 3);
  assert.ok(migration.includes('DROP TYPE "RnDTargetStatus_legacy"'));
  assert.ok(migration.includes('DROP TYPE "RnDJobStatus_legacy"'));
  assert.ok(migration.includes('DROP TYPE "RnDAttemptVerdict_legacy"'));
  assert.ok(migration.includes("'EXHAUSTED'"));
});

test("Italian Bob prompt explicitly prevents above-jaw length", async () => {
  const style = await readFile("generation/styles/women/italian-bob/v1/style.md", "utf8");
  assert.match(style, /HARD LENGTH FLOOR/);
  assert.match(style, /must visibly reach jawline level/);
  assert.match(style, /must not make the overall haircut shorter than jaw length/);
});
