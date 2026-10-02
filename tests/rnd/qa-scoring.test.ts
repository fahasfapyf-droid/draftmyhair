import assert from "node:assert/strict";
import test from "node:test";
import { deriveHairstyleAccuracy } from "../../lib/rnd/qa-scoring";

test("hairstyle accuracy is derived from explicit visual subdimensions", () => {
  const score = deriveHairstyleAccuracy({
    styleLengthAccuracy: 8,
    styleSilhouetteAccuracy: 8,
    styleWeightDistribution: 7,
    stylePerimeterAccuracy: 8,
    styleStylingAccuracy: 8,
    styleRealism: 9,
  });

  assert.equal(score, 7.95);
});

test("a single holistic lowball score cannot override strong subdimension evidence", () => {
  const score = deriveHairstyleAccuracy({
    styleLengthAccuracy: 9,
    styleSilhouetteAccuracy: 8,
    styleWeightDistribution: 8,
    stylePerimeterAccuracy: 9,
    styleStylingAccuracy: 8,
    styleRealism: 9,
  });

  assert.equal(score, 8.45);
});
