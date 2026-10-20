import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const enqueue = readFileSync("app/api/rnd/worker/test-enqueue/route.ts", "utf8");
const cleanup = readFileSync("app/api/rnd/worker/test-cleanup/route.ts", "utf8");
const launcher = readFileSync("scripts/create-rnd-italian-bob-regression.ts", "utf8");

assert.match(enqueue, /requireRndWorker\(request\.headers\.get\("authorization"\)\)/);
assert.match(enqueue, /suppliedTargetKey\.startsWith\(TEST_TARGET_PREFIX\)/);
assert.match(enqueue, /status: "DRAFT", autoAdvanceEnabled: false, createdByUserId: "task3-regression-fixture"/);
assert.match(enqueue, /status: "HUMAN_APPROVAL"/);
assert.match(enqueue, /hairstyleId: null/);
assert.match(enqueue, /verdict: "HUMAN_APPROVAL"/);
assert.doesNotMatch(enqueue, /tx\.hairstyle\.create|tx\.promptVersion\.create/);
assert.match(cleanup, /requireRndWorker\(request\.headers\.get\("authorization"\)\)/);
assert.match(cleanup, /fixture\.name !== TEST_CAMPAIGN_NAME/);
assert.match(cleanup, /fixture\.createdByUserId !== "task3-regression-fixture"/);
assert.match(cleanup, /target\.targetKey\.startsWith\(TEST_TARGET_PREFIX\)/);
assert.match(cleanup, /tx\.rnDAttempt\.deleteMany/);
assert.match(cleanup, /tx\.rnDJob\.deleteMany/);
assert.match(cleanup, /tx\.rnDTarget\.deleteMany/);
assert.match(cleanup, /tx\.rnDCampaign\.delete/);
assert.match(launcher, /task3-approval-fence-fixture-\$\{Date\.now\(\)\}/);
console.log("R&D fixture isolation and cleanup contract passed.");
