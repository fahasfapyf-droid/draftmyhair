import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { transformSync } from "esbuild";
import { eligibleRndApproval, humanApprovalProof, verifiedHumanApproval } from "../lib/rnd/promotion-provenance";

const scores = { overall: 9.5, identity: 9.5, styleAccuracy: 9.5, rootIntegration: 9.5, lightingConsistency: 9.5, hairOnly: "PASS", artifacts: "NONE" };
function fixture(): any { return { id: "attempt", jobId: "job", attemptNumber: 1, prompt: "Approved hair-only prompt", artifactId: "artifact", overallScore: "9.5", aiGatePassed: true, publicationTierPassed: true,
  artifact: { id: "artifact", kind: "GENERATED", storageKey: "rnd/attempts/job/1-image", checksum: "a".repeat(64) },
  qaJson: { ...scores, verdict: "APPROVE", imageIntegrity: { canvasMatch: true, faceTexturePreservationPass: true }, finalVerification: { ...scores, verdict: "PASS" } } }; }
async function main() {
  let count = 0;
  const check = (value: unknown) => { assert.ok(value); count++; };
  check(eligibleRndApproval(fixture()));
  for (const layer of ["primary", "final"]) for (const metric of Object.keys(scores).filter(k => typeof (scores as any)[k] === "number")) {
    for (const value of [9.49, "9.5", null, 11]) { const f = fixture(); (layer === "primary" ? f.qaJson : f.qaJson.finalVerification)[metric] = value; check(!eligibleRndApproval(f)); }
  }
  for (const changes of [{ canvasMatch: false }, { faceTexturePreservationPass: false }, { canvasMatch: "true" }, { faceTexturePreservationPass: null }]) {
    const f = fixture(); Object.assign(f.qaJson.imageIntegrity, changes); check(!eligibleRndApproval(f));
  }
  for (const field of ["imageIntegrity", "finalVerification"]) { const f = fixture(); delete f.qaJson[field]; check(!eligibleRndApproval(f)); }
  for (const changes of [{ id: "other" }, { kind: "SOURCE" }, { storageKey: "rnd/attempts/other/1-image" }, { checksum: null }]) { const f = fixture(); Object.assign(f.artifact, changes); check(!eligibleRndApproval(f)); }
  const f = fixture(); check(!verifiedHumanApproval(f)); f.qaJson.humanApproval = humanApprovalProof(f, "actual-admin-session"); check(verifiedHumanApproval(f));
  for (const changes of [{ attemptId: "forged" }, { artifactId: "forged" }, { artifactChecksum: "b".repeat(64) }, { promptChecksum: "b".repeat(64) }, { reviewerRole: "USER" }, { reviewerId: "" }, { approvedAt: "invalid" }]) {
    const changed = structuredClone(f); Object.assign(changed.qaJson.humanApproval, changes); check(!verifiedHumanApproval(changed));
  }
  const changed = structuredClone(f); changed.prompt += " caller edit"; check(!verifiedHumanApproval(changed));
  for (const filename of ["app/api/internal/prompt-promote/route.ts", "app/api/rnd/e2e-test/route.ts"]) {
    const code = transformSync(readFileSync(filename, "utf8"), { loader: "ts", format: "cjs" }).code;
    let session: unknown = null, effects = 0;
    const mod = { exports: {} as any };
    new Function("require", "module", "exports", code)((name: string) => {
      if (name === "next/server") return { NextResponse: { json: (body: unknown, init?: ResponseInit) => Response.json(body, init) } };
      if (name === "@/auth") return { auth: async () => session };
      return new Proxy({}, { get: () => { effects++; throw new Error("Unexpected privileged operation"); } });
    }, mod, mod.exports);
    const call = mod.exports.POST ?? mod.exports.GET;
    const request = new Request("https://fixture.invalid", { method: "POST", headers: { "x-dmh-promotion-secret": "forged-shared-secret", authorization: "Bearer worker" } });
    request.json = async () => { effects++; throw new Error("Body must not be read"); };
    check((await call(request)).status === 401); check(effects === 0);
    session = { user: { id: "worker", role: "USER" } }; check((await call(request)).status === 401); check(effects === 0);
    if (filename.includes("e2e-test")) { session = { user: { id: "admin", role: "ADMIN" } }; check((await call(request)).status === 410); check(effects === 0); }
  }
  {
    const filename = "app/api/rnd/worker/test-enqueue/route.ts";
    const code = transformSync(readFileSync(filename, "utf8"), { loader: "ts", format: "cjs" }).code;
    let authorized = false, effects = 0;
    const mod = { exports: {} as any };
    new Function("require", "module", "exports", code)((name: string) => {
      if (name === "next/server") return { NextResponse: { json: (body: unknown, init?: ResponseInit) => Response.json(body, init) } };
      if (name === "@/lib/rnd/worker-auth") return { requireRndWorker: () => authorized ? null : new Response(null, { status: 401 }) };
      effects++; throw new Error("Retired worker enqueue must not import writers");
    }, mod, mod.exports);
    const request = new Request("https://fixture.invalid", { method: "POST" });
    request.json = async () => { effects++; throw new Error("Body must not be parsed"); };
    check((await mod.exports.POST(request)).status === 401); authorized = true;
    check((await mod.exports.POST(request)).status === 410); check(effects === 0);
  }
  console.log(`PASS ${count} provenance/auth/retired-writer behavioral assertions; no database, provider, Blob or worker access.`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
