/** Offline Sharp fixtures; preserves the baseline's mandatory texture policy. */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runRndImageIntegrityCheck, passesRndHardIntegrityGate } from "../lib/rnd/image-integrity";

const pairs = [
  ["public/portfolio/bob/blunt-bob-before.webp", "public/portfolio/bob/blunt-bob-after.webp"],
  ["public/portfolio/bob/french-bob-before.webp", "public/portfolio/bob/french-bob-after.webp"],
  ["public/portfolio/buzzcut/0mm-buzz-before.webp", "public/portfolio/buzzcut/0mm-buzz-after.webp"],
  ["public/portfolio/dye-color-change/dye-color-change-natural-black-to-blonde-before.webp", "public/portfolio/dye-color-change/dye-color-change-natural-black-to-blonde-after.webp"],
  ["public/portfolio/bixie/bixie-before.webp", "public/portfolio/bixie/executive-textured-bixie-after.webp"],
  ...["expression", "face", "lighting", "skin"].map(name => [`public/images/proof/${name}-original.webp`, `public/images/proof/${name}-preview.webp`]),
];
async function main() {
  let vetoes = 0;
  for (const [source, output] of pairs) {
    const result = await runRndImageIntegrityCheck(await readFile(source), await readFile(output));
    assert.equal(result.canvasMatch, true);
    assert.equal(passesRndHardIntegrityGate(result), result.faceTexturePreservationPass);
    if (!result.faceTexturePreservationPass) vetoes++;
    console.log(`${output}: canvas=${result.canvasMatch} texture=${result.faceTexturePreservationPass} drift=${result.faceRegionDrift.toFixed(4)} ratio=${result.faceTextureRatio.toFixed(4)}`);
  }
  assert.equal(vetoes, 6, "baseline six texture vetoes must remain blocking; no detector/threshold change");
  console.log(`PASS ${pairs.length} offline image-pair regressions; ${vetoes} mandatory texture vetoes preserved. Repeated proof originals are not independent identities.`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
