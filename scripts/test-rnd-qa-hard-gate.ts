import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { passesRndCombinedHardGate } from "../lib/rnd/qa-hard-gate";
import { parseFinalVerification, parseQa } from "../lib/rnd/qa";

const goodQa = {
  verdict: "APPROVE",
  overall: 9.8,
  identity: 9.8,
  styleAccuracy: 9.7,
  rootIntegration: 9.8,
  lightingConsistency: 9.7,
  hairOnly: "PASS",
  artifacts: "NONE",
};
const goodFinal = { ...goodQa, verdict: "PASS" };
const goodIntegrity = { canvasMatch: true };
const pass = () => passesRndCombinedHardGate({
  qa: { ...goodQa },
  imageIntegrity: { ...goodIntegrity },
  finalVerification: { ...goodFinal },
});

const inconsistentQa = parseQa(JSON.stringify({
  overall: 9.9, identity: 9.4, styleAccuracy: 9.9, rootIntegration: 9.9,
  lightingConsistency: 9.9, hairOnly: "PASS", artifacts: "NONE",
  verdict: "APPROVE", reason: "model reason", refinement: "correct hair shape",
}));
assert.equal(inconsistentQa.verdict, "REGENERATE", "an inconsistent APPROVE must downgrade, never throw or pass");
assert.match(inconsistentQa.reason, /downgraded an inconsistent APPROVE/i);

const inconsistentFinal = parseFinalVerification(JSON.stringify({
  overall: 9.9, identity: 9.4, styleAccuracy: 9.9, rootIntegration: 9.9,
  lightingConsistency: 9.9, hairOnly: "PASS", artifacts: "NONE",
  verdict: "PASS", reason: "model reason", refinement: "correct hair shape",
}));
assert.equal(inconsistentFinal.verdict, "REJECT", "an inconsistent final PASS must downgrade, never throw or pass");
assert.match(inconsistentFinal.reason, /downgraded an inconsistent PASS/i);
assert.throws(() => parseQa(""), "empty evaluator JSON must remain a classified parse failure");

assert.equal(pass(), true, "all gates passing must approve");

assert.equal(passesRndCombinedHardGate({
  qa: { ...goodQa }, imageIntegrity: { ...goodIntegrity }, finalVerification: null,
}), false, "first evaluator alone must not approve");

assert.equal(passesRndCombinedHardGate({
  qa: { ...goodQa }, imageIntegrity: { ...goodIntegrity },
  finalVerification: { ...goodFinal, verdict: "REJECT" },
}), false, "second evaluator rejection must block approval");

for (const evaluator of ["qa", "finalVerification"] as const) {
  for (const score of ["overall", "identity", "styleAccuracy", "rootIntegration", "lightingConsistency"] as const) {
    const input = {
      qa: { ...goodQa },
      imageIntegrity: { ...goodIntegrity },
      finalVerification: { ...goodFinal },
    };
    input[evaluator][score] = 9.49;
    assert.equal(passesRndCombinedHardGate(input), false, evaluator + "." + score + " below 9.5 must block approval");
  }
}

for (const evaluator of ["qa", "finalVerification"] as const) {
  for (const field of ["hairOnly", "artifacts"] as const) {
    const input = {
      qa: { ...goodQa },
      imageIntegrity: { ...goodIntegrity },
      finalVerification: { ...goodFinal },
    };
    if (field === "hairOnly") input[evaluator].hairOnly = "FAIL";
    else input[evaluator].artifacts = "PRESENT";
    assert.equal(passesRndCombinedHardGate(input), false, evaluator + "." + field + " failure must block approval");
  }
}

assert.equal(passesRndCombinedHardGate({
  qa: { ...goodQa }, imageIntegrity: null, finalVerification: { ...goodFinal },
}), false, "missing integrity result must block approval");
assert.equal(passesRndCombinedHardGate({
  qa: { ...goodQa }, imageIntegrity: { canvasMatch: false }, finalVerification: { ...goodFinal },
}), false, "canvas integrity failure must block approval");

assert.equal(passesRndCombinedHardGate({
  qa: { ...goodQa, verdict: "REJECT" }, imageIntegrity: { ...goodIntegrity },
  finalVerification: { ...goodFinal },
}), false, "first evaluator rejection must block approval");

const reportRoute = readFileSync("app/api/rnd/worker/report/route.ts", "utf8");
assert.match(reportRoute, /verdict: hardPass \? "HUMAN_APPROVAL" : "REFINE"/,
  "attempt verdict must derive from the combined hard gate");
assert.match(reportRoute, /if \(hardPass\) \{[\s\S]{0,300}status: "HUMAN_APPROVAL"/,
  "job transition to HUMAN_APPROVAL must be guarded by hardPass");
assert.doesNotMatch(reportRoute, /faceTexturePreservationPass\s*===\s*true/,
  "uncalibrated texture diagnostics must not veto best-candidate selection");
assert.equal((reportRoute.match(/passesRndHardIntegrityGate\(\{ canvasMatch: integrity\.canvasMatch \}\)/g) ?? []).length, 2,
  "POST and GET candidate selection must use the deterministic hard-integrity gate");

console.log("R&D combined QA hard-gate tests passed, including approval-transition guard.");
