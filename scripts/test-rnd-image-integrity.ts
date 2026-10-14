import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { runRndImageIntegrityCheck, passesRndHardIntegrityGate } from "../lib/rnd/image-integrity";

const root = process.cwd();
const cases = [
  ["public/portfolio/bob/blunt-bob-before.webp", "public/portfolio/bob/blunt-bob-after.webp"],
  ["public/portfolio/bob/french-bob-before.webp", "public/portfolio/bob/french-bob-after.webp"],
  ["public/portfolio/buzzcut/0mm-buzz-before.webp", "public/portfolio/buzzcut/0mm-buzz-after.webp"],
  ["public/portfolio/dye-color-change/dye-color-change-natural-black-to-blonde-before.webp", "public/portfolio/dye-color-change/dye-color-change-natural-black-to-blonde-after.webp"],
  ["public/portfolio/bixie/bixie-before.webp", "public/portfolio/bixie/executive-textured-bixie-after.webp"],
  ["public/images/proof/expression-original.webp", "public/images/proof/expression-preview.webp"],
  ["public/images/proof/face-original.webp", "public/images/proof/face-preview.webp"],
  ["public/images/proof/lighting-original.webp", "public/images/proof/lighting-preview.webp"],
  ["public/images/proof/skin-original.webp", "public/images/proof/skin-preview.webp"],
] as const;

async function main() {
  let diagnosticOnlyFailures = 0;
  for (const [sourcePath, generatedPath] of cases) {
    const source = await readFile(path.join(root, sourcePath));
    const generated = await readFile(path.join(root, generatedPath));
    const result = await runRndImageIntegrityCheck(source, generated);
    assert.equal(result.canvasMatch, true, `${generatedPath}: expected compatible canvas`);
    assert.equal(passesRndHardIntegrityGate(result), true, `${generatedPath}: diagnostic must not veto hard integrity gate`);
    if (!result.faceTexturePreservationPass) diagnosticOnlyFailures += 1;
    console.log(`${passesRndHardIntegrityGate(result) ? "PASS" : "FAIL"} ${generatedPath} canvas=true drift=${result.faceRegionDrift.toFixed(4)} texture=${result.faceTextureRatio.toFixed(4)} textureDiagnostic=${result.faceTexturePreservationPass ? "pass" : "warn-only"}`);
  }
  assert.equal(passesRndHardIntegrityGate({ canvasMatch: false }), false, "canvas mismatch must still fail the deterministic gate");
  assert.ok(diagnosticOnlyFailures > 0, "regression set should exercise cases that previously failed the uncalibrated texture gate");
  const report = await readFile(path.join(root, "app/api/rnd/worker/report/route.ts"), "utf8");
  assert.match(report, /passesRndCombinedHardGate\(/, "report route must use the combined hard-gate helper");
  assert.doesNotMatch(report, /imageIntegrity\?\.faceTexturePreservationPass\s*===\s*true/, "uncalibrated texture diagnostic must not veto approval");
  console.log(`RESULT: ${cases.length} image-pair regressions passed; ${diagnosticOnlyFailures} would have been rejected by the old uncalibrated texture gate; canvas mismatch remains blocking.`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });