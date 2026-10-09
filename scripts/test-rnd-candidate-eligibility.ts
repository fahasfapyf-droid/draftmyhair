import test from "node:test";
import assert from "node:assert/strict";
import { isEligibleRndCandidate } from "../lib/rnd/candidate-eligibility";

const valid = (): any => ({
  artifactId: "test-artifact",
  overallScore: 9.8,
  aiGatePassed: true,
  publicationTierPassed: true,
  qaJson: {
    hairOnly: "PASS",
    artifacts: "NONE",
    imageIntegrity: { canvasMatch: true, faceTexturePreservationPass: true },
    finalVerification: {
      verdict: "PASS",
      overall: 9.8,
      identity: 9.8,
      styleAccuracy: 9.8,
      rootIntegration: 9.8,
      lightingConsistency: 9.8,
      hairOnly: "PASS",
      artifacts: "NONE",
    },
  },
});

test("accepts a candidate that passes every hard gate", () => {
  assert.equal(isEligibleRndCandidate(valid()), true);
});

test("rejects a candidate if any independent hard gate fails", () => {
  const cases: Array<[string, (v: ReturnType<typeof valid>) => void]> = [
    ["missing artifact", (v) => { v.artifactId = null; }],
    ["AI gate", (v) => { v.aiGatePassed = false; }],
    ["publication gate", (v) => { v.publicationTierPassed = false; }],
    ["hair-only QA", (v) => { v.qaJson.hairOnly = "FAIL"; }],
    ["artifact QA", (v) => { v.qaJson.artifacts = "FOUND"; }],
    ["canvas mismatch", (v) => { v.qaJson.imageIntegrity.canvasMatch = false; }],
    ["face texture changed", (v) => { v.qaJson.imageIntegrity.faceTexturePreservationPass = false; }],
    ["independent verdict", (v) => { v.qaJson.finalVerification.verdict = "REJECT"; }],
    ["overall below threshold", (v) => { v.qaJson.finalVerification.overall = 9.4; }],
    ["identity below threshold", (v) => { v.qaJson.finalVerification.identity = 9.4; }],
    ["style below threshold", (v) => { v.qaJson.finalVerification.styleAccuracy = 9.4; }],
    ["roots below threshold", (v) => { v.qaJson.finalVerification.rootIntegration = 9.4; }],
    ["lighting below threshold", (v) => { v.qaJson.finalVerification.lightingConsistency = 9.4; }],
    ["missing verification", (v) => { delete v.qaJson.finalVerification; }],
    ["invalid score", (v) => { v.qaJson.finalVerification.identity = Number.NaN; }],
  ];
  for (const [name, mutate] of cases) {
    const candidate = valid();
    mutate(candidate);
    assert.equal(isEligibleRndCandidate(candidate), false, name);
  }
});

test("rejects scores above the valid range and malformed QA payloads", () => {
  const tooHigh = valid();
  tooHigh.qaJson.finalVerification.identity = 10.1;
  assert.equal(isEligibleRndCandidate(tooHigh), false);
  assert.equal(isEligibleRndCandidate({ ...valid(), qaJson: null }), false);
});
