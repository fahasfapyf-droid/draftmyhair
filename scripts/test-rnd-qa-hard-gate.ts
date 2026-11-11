/** Behavioral QA tests with a fake model; source assertions are labeled separately. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { transformSync } from "esbuild";
import { passesRndCombinedHardGate } from "../lib/rnd/qa-hard-gate";

async function main() {
  let returned: unknown;
  const requests: unknown[] = [];
  const code = transformSync(readFileSync("lib/rnd/qa.ts", "utf8"), { loader: "ts", format: "cjs" }).code;
  const mod = { exports: {} as Record<string, any> };
  new Function("require", "module", "exports", code)(() => ({ GoogleGenAI: class {
    models = { generateContent: async (request: unknown) => { requests.push(request); return { text: JSON.stringify(returned) }; } };
  } }), mod, mod.exports);
  const names = ["GOOGLE_CLOUD_PROJECT_ID", "GOOGLE_CLOUD_LOCATION", "GOOGLE_SERVICE_ACCOUNT_JSON"];
  const saved = names.map(name => process.env[name]);
  process.env.GOOGLE_CLOUD_PROJECT_ID = "offline";
  process.env.GOOGLE_CLOUD_LOCATION = "offline";
  process.env.GOOGLE_SERVICE_ACCOUNT_JSON = "{}";
  const good = { overall: 9.5, identity: 9.5, styleAccuracy: 9.5, rootIntegration: 9.5, lightingConsistency: 9.5, hairOnly: "PASS", artifacts: "NONE", verdict: "APPROVE", reason: "offline fixture", refinement: "" };
  const integrity = { canvasMatch: true, faceTexturePreservationPass: true };
  let assertions = 0;
  try {
    for (const [name, verdict] of [["runRndQa", "APPROVE"], ["runRndFinalVerification", "PASS"]]) {
      const run = () => mod.exports[name](Buffer.from("source"), "image/png", Buffer.from("generated"), "image/png", "Authoritative Italian Bob");
      returned = { ...good, verdict };
      assert.equal((await run()).verdict, verdict); assertions++;
      for (const metric of ["identity", "styleAccuracy", "rootIntegration", "lightingConsistency"]) {
        returned = { ...good, verdict, [metric]: 9.49 };
        await assert.rejects(run(), /inconsistent/); assertions++;
      }
      for (const invalid of [null, [], {}, { ...good, verdict, identity: "9.5" }]) {
        returned = invalid;
        await assert.rejects(run()); assertions++;
      }
    }
    const input = () => ({ qa: { ...good }, finalVerification: { ...good, verdict: "PASS" }, imageIntegrity: { ...integrity } });
    assert.equal(passesRndCombinedHardGate(input()), true); assertions++;
    for (const evaluator of ["qa", "finalVerification"] as const) {
      for (const metric of ["overall", "identity", "styleAccuracy", "rootIntegration", "lightingConsistency"] as const) {
        const value = input(); value[evaluator][metric] = 9.49;
        assert.equal(passesRndCombinedHardGate(value), false); assertions++;
      }
      for (const changes of [{ hairOnly: "FAIL" }, { artifacts: "FOUND" }, { verdict: "REJECT" }]) {
        const value = input(); Object.assign(value[evaluator], changes);
        assert.equal(passesRndCombinedHardGate(value), false); assertions++;
      }
    }
    for (const imageIntegrity of [null, { canvasMatch: false, faceTexturePreservationPass: true }, { canvasMatch: true, faceTexturePreservationPass: false }, { canvasMatch: true }]) {
      assert.equal(passesRndCombinedHardGate({ ...input(), imageIntegrity }), false); assertions++;
    }
    assert.equal(passesRndCombinedHardGate({ ...input(), finalVerification: null }), false); assertions++;
    assert.ok(requests.every(request => !JSON.stringify(request).includes("HINDSIGHT"))); assertions++;
    console.log(`PASS ${assertions} behavioral QA/parser/combined-gate assertions: 9.49 veto, 9.5 boundary, final veto, both integrity checks.`);
    const report = readFileSync("app/api/rnd/worker/report/route.ts", "utf8");
    assert.match(report, /if \(hardPass\) \{[\s\S]{0,300}status: "HUMAN_APPROVAL"/);
    assert.equal((report.match(/passesRndHardIntegrityGate\(\{ canvasMatch: integrity\.canvasMatch, faceTexturePreservationPass: integrity\.faceTexturePreservationPass \}\)/g) ?? []).length, 2);
    console.log("PASS static source assertions: human approval guarded by hardPass; both candidate paths require both integrity results. Not runtime transaction proof.");
  } finally { names.forEach((name, i) => { if (saved[i] === undefined) delete process.env[name]; else process.env[name] = saved[i]; }); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
