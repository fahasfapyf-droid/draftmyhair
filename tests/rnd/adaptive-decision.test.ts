import assert from "node:assert/strict";
import test from "node:test";
import { decideAdaptiveRefinement, type AdaptiveAttempt } from "../../lib/rnd/adaptive-decision";

function qa(overrides: Record<string, unknown> = {}) {
  return {
    overall: 6,
    identity: 9.8,
    hairstyleAccuracy: 6,
    beardAccuracy: 10,
    colorAccuracy: 10,
    buzzBaldAccuracy: 10,
    rootIntegration: 9,
    lightingConsistency: 9.8,
    hairOnly: "PASS",
    transformationOnly: "PASS",
    artifacts: "NONE",
    verdict: "REGENERATE",
    transformationGate: { passed: true, noOp: false },
    verifier: { blockingDefect: false },
    ...overrides,
  };
}

function previousAttempt(overrides: Partial<AdaptiveAttempt> = {}): AdaptiveAttempt {
  return {
    attemptNumber: 1,
    overallScore: 6,
    aiGatePassed: false,
    verdict: "REFINE",
    refinementReason: "ADAPTIVE_DECISION:{\"category\":\"COLOR\",\"property\":\"hair color\",\"strategy\":\"COLOR_CORRECT\"}",
    qaJson: qa({ colorAccuracy: 5 }),
    prompt: "authoritative style plus first correction",
    promptRevision: "rev-1",
    artifactId: "artifact-1",
    adaptiveDecision: { strategy: "COLOR_CORRECT" },
    ...overrides,
  };
}

test("adaptive comparisons use QA's lightingConsistency field to detect regression", () => {
  const result = decideAdaptiveRefinement({
    defect: "hair color is inaccurate",
    qa: qa({ colorAccuracy: 6, lightingConsistency: 8.9 }),
    history: [previousAttempt({ qaJson: qa({ colorAccuracy: 5, lightingConsistency: 9.8 }) })],
    attemptNumber: 2,
    maxAttempts: 8,
  });

  assert.equal(result.action, "HUMAN_REVIEW");
  assert.equal(result.regression, true);
  assert.deepEqual(result.evidence.regressedDimensions, ["lightingConsistency"]);
});

test("color and beard target scores use their actual QA field names", () => {
  const colorResult = decideAdaptiveRefinement({
    defect: "hair color shade is inaccurate",
    qa: qa({ colorAccuracy: 6 }),
    history: [previousAttempt({ qaJson: qa({ colorAccuracy: 5 }) })],
    attemptNumber: 2,
    maxAttempts: 8,
  });
  assert.equal(colorResult.action, "REFINE");
  assert.equal(colorResult.plateau, false);
  assert.equal(colorResult.strategy, "COLOR_CORRECT");

  const beardHistory = [previousAttempt({
    refinementReason: "ADAPTIVE_DECISION:{\"category\":\"BEARD\",\"property\":\"beard\",\"strategy\":\"BEARD_CORRECT\"}",
    adaptiveDecision: { strategy: "BEARD_CORRECT" },
    qaJson: qa({ beardAccuracy: 5 }),
  })];
  const beardResult = decideAdaptiveRefinement({
    defect: "mustache is incorrect",
    qa: qa({ beardAccuracy: 6 }),
    history: beardHistory,
    attemptNumber: 2,
    maxAttempts: 8,
  });
  assert.equal(beardResult.action, "REFINE");
  assert.equal(beardResult.plateau, false);
  assert.equal(beardResult.strategy, "BEARD_CORRECT");
});

test("comparison evidence includes prior QA, gates, strategy, prompt and artifact and excludes the reserved current row", () => {
  const result = decideAdaptiveRefinement({
    defect: "hair color shade is inaccurate",
    qa: qa({ colorAccuracy: 6 }),
    history: [
      previousAttempt(),
      previousAttempt({ attemptNumber: 2, qaJson: null, artifactId: null, prompt: "reserved attempt" }),
    ],
    attemptNumber: 2,
    maxAttempts: 8,
    currentPrompt: "authoritative style plus first correction",
    currentPromptRevision: "rev-2",
    currentArtifactId: "artifact-2",
  });

  assert.deepEqual(result.evidence.comparedAttemptNumbers, [1]);
  assert.equal(result.evidence.priorAttempts[0].scores.colorAccuracy, 5);
  assert.equal(result.evidence.priorAttempts[0].gates.hairOnly, "PASS");
  assert.equal(result.evidence.priorAttempts[0].strategy, "COLOR_CORRECT");
  assert.equal(result.evidence.priorAttempts[0].promptRevision, "rev-1");
  assert.equal(result.evidence.priorAttempts[0].artifactId, "artifact-1");
  assert.equal(result.evidence.current.promptRevision, "rev-2");
  assert.equal(result.evidence.current.artifactId, "artifact-2");
  assert.equal(result.evidence.current.promptChangedFromPrevious, false);
});

test("beardAccuracy and colorAccuracy regressions are protected", () => {
  for (const dimension of ["beardAccuracy", "colorAccuracy"] as const) {
    const priorQa = qa({ [dimension]: 9.5 });
    const currentQa = qa({ [dimension]: 8.9 });
    const result = decideAdaptiveRefinement({
      defect: dimension === "beardAccuracy" ? "mustache is incorrect" : "hair color is inaccurate",
      qa: currentQa,
      history: [previousAttempt({ qaJson: priorQa })],
      attemptNumber: 2,
      maxAttempts: 8,
    });
    assert.equal(result.action, "HUMAN_REVIEW", `${dimension} regression should escalate`);
    assert.ok(result.evidence.regressedDimensions.includes(dimension));
  }
});

test("combined jaw-level silhouette and density diagnosis selects silhouette correction", () => {
  const result = decideAdaptiveRefinement({
    defect: "Lack of a distinct rounded/compact silhouette, insufficient substantial jaw-level volume, and insufficient side density; strengthen the inward contour.",
    qa: qa({ hairstyleAccuracy: 4 }),
    history: [],
    attemptNumber: 2,
    maxAttempts: 8,
  });

  assert.equal(result.category, "SILHOUETTE");
  assert.equal(result.strategy, "SILHOUETTE_STRENGTHEN_INWARD_CONTOUR");
  assert.match(result.instruction ?? "", /rounded, compact jaw-level silhouette/);
  assert.match(result.instruction ?? "", /inward side contour/);
  assert.match(result.instruction ?? "", /Do not preserve a length that QA has identified as defective/);
});





test("length correction authorizes only the geometry directly dependent on the diagnosed length", () => {
  const result = decideAdaptiveRefinement({
    defect: "The hair is significantly shorter than the requested jaw-length bob.",
    qa: qa({ styleLengthAccuracy: 3, hairstyleAccuracy: 3 }),
    history: [],
    attemptNumber: 2,
    maxAttempts: 8,
  });

  assert.equal(result.strategy, "LENGTH_CORRECT");
  assert.match(result.instruction ?? "", /minimum dependent perimeter and silhouette geometry/);
  assert.match(result.instruction ?? "", /physically coherent/);
  assert.match(result.instruction ?? "", /every unrelated passing property/);
});

test("bilateral silhouette diagnosis selects the symmetry-specific strategy", () => {
  const result = decideAdaptiveRefinement({
    defect: "The inward blowout and rounded silhouette are inconsistent across both sides; the left side has more density than the right side.",
    qa: qa({
      hairstyleAccuracy: 4,
      styleSilhouetteAccuracy: 3,
      styleWeightDistribution: 3,
      styleStylingAccuracy: 2,
    }),
    history: [],
    attemptNumber: 2,
    maxAttempts: 8,
  });

  assert.equal(result.category, "SILHOUETTE");
  assert.equal(result.strategy, "SILHOUETTE_BILATERAL_SYMMETRY");
  assert.match(result.instruction ?? "", /left\/right silhouette inconsistency/);
  assert.match(result.instruction ?? "", /both sides/);
});

test("volume-only diagnosis keeps localized volume strategy", () => {
  const result = decideAdaptiveRefinement({
    defect: "Insufficient substantial jaw-level volume and side density.",
    qa: qa({ hairstyleAccuracy: 4 }),
    history: [],
    attemptNumber: 2,
    maxAttempts: 8,
  });

  assert.equal(result.category, "VOLUME");
  assert.equal(result.strategy, "VOLUME_INCREASE_LOCALIZED");
});
