export type AdaptiveAction = "REFINE" | "HUMAN_REVIEW" | "EXHAUSTED";
export type DefectCategory = "VOLUME" | "SILHOUETTE" | "LENGTH" | "TEXTURE" | "ROOT" | "COLOR" | "BEARD" | "ARTIFACT" | "UNKNOWN";
export type AdaptiveStrategy =
  | "VOLUME_INCREASE_LOCALIZED" | "VOLUME_DENSITY_REINFORCE" | "VOLUME_REDUCE_EXCESS" | "VOLUME_COMPACT_REDUCE"
  | "SILHOUETTE_STRENGTHEN_INWARD_CONTOUR" | "SILHOUETTE_TIGHTEN_JAW_CONTOUR" | "SILHOUETTE_REDUCE_EXCESS_ROUNDING"
  | "LENGTH_CORRECT" | "TEXTURE_CORRECT" | "ROOT_INTEGRATION_CORRECT"
  | "COLOR_CORRECT" | "BEARD_CORRECT" | "ARTIFACT_REMOVE";

export type AdaptiveAttempt = {
  attemptNumber: number;
  overallScore: number | null;
  aiGatePassed: boolean | null;
  verdict: string;
  refinementReason: string | null;
  qaJson: any;
  prompt?: string | null;
  promptRevision?: string | null;
  artifactId?: string | null;
  adaptiveDecision?: unknown;
};

export type AdaptiveDecision = {
  action: AdaptiveAction;
  category: DefectCategory;
  property: string;
  strategy: AdaptiveStrategy | null;
  instruction: string | null;
  reason: string;
  regression: boolean;
  plateau: boolean;
  priorStrategies: AdaptiveStrategy[];
  evidence: {
    comparedAttemptNumbers: number[];
    priorAttempts: Array<{
      attemptNumber: number;
      scores: Record<string, number | null>;
      gates: Record<string, string | boolean | null>;
      verdict: string;
      defect: string | null;
      strategy: AdaptiveStrategy | null;
      promptRevision: string | null;
      artifactId: string | null;
    }>;
    current: {
      attemptNumber: number;
      scores: Record<string, number | null>;
      gates: Record<string, string | boolean | null>;
      verdict: string;
      defect: string;
      promptRevision: string | null;
      artifactId: string | null;
      promptChangedFromPrevious: boolean | null;
    };
    improvedDimensions: string[];
    regressedDimensions: string[];
  };
};

function classifyDefect(defect: string): { category: DefectCategory; property: string; direction: "increase" | "reduce" | "correct" } {
  const d = defect.toLowerCase();
  const increase = /(insufficient|too little|needs more|lack(?:s|ing)?|weak|under|not enough|more weight|more volume|more density)/.test(d);
  const reduce = /(excess|too much|overly|too heavy|too wide|too rounded|too bulky|too dense|reduce|less volume)/.test(d);
  // Explicit length defects take precedence over silhouette classification. A diagnosis such as
  // "hair remains long/past the shoulders" must authorize a length correction rather
  // than a contour-only refinement that can preserve the defective length.
  if (/(length|jaw[- ]?length|past the shoulders|shoulder[- ]length|too long|too short|shorter|longer|reaches the shoulders|below the jaw|below the chin|above the jaw|above the chin)/.test(d)) return { category: "LENGTH", property: "hair length", direction: "correct" };
  if (/(silhouette|shape|contour|curve|curvature|rounded|compact|straight side|inward)/.test(d)) return { category: "SILHOUETTE", property: "hair silhouette/contour", direction: reduce ? "reduce" : increase ? "increase" : "correct" };
  if (/(volume|weight|density|fullness|body)/.test(d)) return { category: "VOLUME", property: "hair volume/weight", direction: increase ? "increase" : reduce ? "reduce" : "correct" };
  if (/(texture|wave|curl|strand|sleek|rough|frizz)/.test(d)) return { category: "TEXTURE", property: "hair texture", direction: "correct" };
  if (/(root|scalp|hairline|integration|blend)/.test(d)) return { category: "ROOT", property: "root/scalp integration", direction: "correct" };
  if (/(color|colour|tone|dye|shade)/.test(d)) return { category: "COLOR", property: "hair color", direction: "correct" };
  if (/(beard|facial hair|mustache|moustache)/.test(d)) return { category: "BEARD", property: "beard/facial hair", direction: "correct" };
  if (/(artifact|artefact|halo|seam|ghost|duplicate|warping)/.test(d)) return { category: "ARTIFACT", property: "rendering artifact", direction: "correct" };
  return { category: "UNKNOWN", property: "unknown property", direction: "correct" };
}

function strategiesFor(category: DefectCategory, direction: ReturnType<typeof classifyDefect>["direction"]): AdaptiveStrategy[] {
  if (category === "VOLUME") return direction === "reduce" ? ["VOLUME_REDUCE_EXCESS", "VOLUME_COMPACT_REDUCE"] : ["VOLUME_INCREASE_LOCALIZED", "VOLUME_DENSITY_REINFORCE"];
  if (category === "SILHOUETTE") return direction === "reduce" ? ["SILHOUETTE_REDUCE_EXCESS_ROUNDING"] : ["SILHOUETTE_STRENGTHEN_INWARD_CONTOUR", "SILHOUETTE_TIGHTEN_JAW_CONTOUR"];
  if (category === "LENGTH") return ["LENGTH_CORRECT"];
  if (category === "TEXTURE") return ["TEXTURE_CORRECT"];
  if (category === "ROOT") return ["ROOT_INTEGRATION_CORRECT"];
  if (category === "COLOR") return ["COLOR_CORRECT"];
  if (category === "BEARD") return ["BEARD_CORRECT"];
  if (category === "ARTIFACT") return ["ARTIFACT_REMOVE"];
  return [];
}
function parseStrategy(reason: string | null, decision?: unknown): AdaptiveStrategy | null {
  if (decision && typeof decision === "object" && "strategy" in decision) {
    const value = (decision as { strategy?: unknown }).strategy;
    if (typeof value === "string" && STRATEGIES.has(value as AdaptiveStrategy)) return value as AdaptiveStrategy;
  }
  if (!reason) return null;
  const marker = "ADAPTIVE_DECISION:";
  const index = reason.indexOf(marker);
  if (index < 0) return null;
  try {
    const parsed = JSON.parse(reason.slice(index + marker.length).trim());
    return typeof parsed.strategy === "string" && STRATEGIES.has(parsed.strategy as AdaptiveStrategy)
      ? parsed.strategy as AdaptiveStrategy
      : null;
  } catch { return null; }
}

function parseCategory(decision: unknown): DefectCategory | null {
  if (!decision || typeof decision !== "object" || !("category" in decision)) return null;
  const value = (decision as { category?: unknown }).category;
  return typeof value === "string" && ["VOLUME", "SILHOUETTE", "LENGTH", "TEXTURE", "ROOT", "COLOR", "BEARD", "ARTIFACT", "UNKNOWN"].includes(value)
    ? value as DefectCategory
    : null;
}

const STRATEGIES = new Set<AdaptiveStrategy>([
  "VOLUME_INCREASE_LOCALIZED", "VOLUME_DENSITY_REINFORCE", "VOLUME_REDUCE_EXCESS", "VOLUME_COMPACT_REDUCE",
  "SILHOUETTE_STRENGTHEN_INWARD_CONTOUR", "SILHOUETTE_TIGHTEN_JAW_CONTOUR", "SILHOUETTE_REDUCE_EXCESS_ROUNDING",
  "LENGTH_CORRECT", "TEXTURE_CORRECT", "ROOT_INTEGRATION_CORRECT", "COLOR_CORRECT", "BEARD_CORRECT", "ARTIFACT_REMOVE",
]);

function scoreOf(qa: any, key: string) {
  const value = Number(qa?.[key]);
  return Number.isFinite(value) ? value : null;
}

const SCORE_KEYS = [
  "overall", "identity", "hairstyleAccuracy", "beardAccuracy", "colorAccuracy",
  "buzzBaldAccuracy", "rootIntegration", "lightingConsistency",
];

function compareScores(current: any, history: AdaptiveAttempt[]) {
  const improvedDimensions: string[] = [];
  const regressedDimensions: string[] = [];
  for (const key of SCORE_KEYS) {
    const currentScore = scoreOf(current, key);
    if (currentScore == null) continue;
    const previousScores = history.map((attempt) => scoreOf(attempt.qaJson, key)).filter((value): value is number => value != null);
    if (!previousScores.length) continue;
    const best = Math.max(...previousScores);
    if (currentScore - best >= 0.5) improvedDimensions.push(key);
    if (best - currentScore >= 0.5) regressedDimensions.push(key);
  }
  return { improvedDimensions, regressedDimensions };
}

function regressionDetected(current: any, history: AdaptiveAttempt[], regressedDimensions: string[]) {
  if (regressedDimensions.length) return true;
  const gateKeys = ["hairOnly", "transformationOnly"] as const;
  for (const key of gateKeys) {
    const currentResult = current?.[key];
    if (currentResult === "FAIL" && history.some((attempt) => attempt.qaJson?.[key] === "PASS")) return true;
  }
  if (current?.transformationGate?.passed === false && history.some((attempt) => attempt.qaJson?.transformationGate?.passed === true)) return true;
  if (current?.transformationGate?.noOp === true && history.some((attempt) => attempt.qaJson?.transformationGate?.noOp === false)) return true;
  if (current?.artifacts === "FOUND" && history.some((attempt) => attempt.qaJson?.artifacts === "NONE")) return true;
  if (current?.verifier?.blockingDefect === true && history.some((attempt) => attempt.qaJson?.verifier?.blockingDefect === false)) return true;
  return false;
}

function scoreSnapshot(qa: any) {
  return Object.fromEntries(SCORE_KEYS.map((key) => [key, scoreOf(qa, key)]));
}

function gateSnapshot(qa: any, aiGatePassed: boolean | null) {
  return {
    aiGatePassed,
    hairOnly: qa?.hairOnly ?? null,
    transformationOnly: qa?.transformationOnly ?? null,
    transformationGatePassed: typeof qa?.transformationGate?.passed === "boolean" ? qa.transformationGate.passed : null,
    transformationGateNoOp: typeof qa?.transformationGate?.noOp === "boolean" ? qa.transformationGate.noOp : null,
    artifacts: qa?.artifacts ?? null,
    verifierBlockingDefect: typeof qa?.verifier?.blockingDefect === "boolean" ? qa.verifier.blockingDefect : null,
  };
}
function targetScore(qa: any, category: DefectCategory) {
  if (category === "VOLUME" || category === "SILHOUETTE" || category === "LENGTH" || category === "TEXTURE") return scoreOf(qa, "hairstyleAccuracy");
  if (category === "ROOT") return scoreOf(qa, "rootIntegration");
  if (category === "COLOR") return scoreOf(qa, "colorAccuracy");
  if (category === "BEARD") return scoreOf(qa, "beardAccuracy");
  if (category === "ARTIFACT") return qa?.artifacts === "NONE" ? 10 : 0;
  return scoreOf(qa, "overall");
}
function makeInstruction(strategy: AdaptiveStrategy, defect: string) {
  const base = "Apply exactly one targeted correction to the diagnosed property. Preserve identity, face, ears, skull geometry, lighting, framing, background, color balance, and every previously passing property.";
  const map: Record<AdaptiveStrategy, string> = {
    VOLUME_INCREASE_LOCALIZED: "Increase only the missing local hair volume/weight where QA identified insufficiency; do not enlarge unrelated areas.",
    VOLUME_DENSITY_REINFORCE: "Reinforce only the diagnosed local density and internal weight at the deficient jaw-level region; do not increase the global silhouette.",
    VOLUME_REDUCE_EXCESS: "Reduce only the excessive hair volume/weight identified by QA; do not flatten unrelated areas.",
    VOLUME_COMPACT_REDUCE: "Compact only the diagnosed excessive volume while preserving the authoritative perimeter and local density elsewhere.",
    SILHOUETTE_STRENGTHEN_INWARD_CONTOUR: "Reshape hair only into a distinct rounded, compact jaw-level silhouette by strengthening the inward side contour and adding substantial localized jaw-level volume and side density only as needed to form that outline. Do not preserve a length that QA has identified as defective; preserve all unrelated global shape, volume, and styling.",
    SILHOUETTE_TIGHTEN_JAW_CONTOUR: "Tighten only the jaw-level contour so the required compact inward curve reads clearly; do not alter length, texture, or global density.",
    SILHOUETTE_REDUCE_EXCESS_ROUNDING: "Reduce only the excessive rounding or width in the diagnosed contour while preserving the authoritative shape and length.",
    LENGTH_CORRECT: "Correct only the diagnosed hair length to the authoritative hairstyle definition; preserve silhouette, texture, and styling.",
    TEXTURE_CORRECT: "Correct only the diagnosed hair texture/styling characteristic; preserve geometry, length, and density.",
    ROOT_INTEGRATION_CORRECT: "Correct only the diagnosed root/scalp integration or hairline blend; do not alter face or skull geometry.",
    COLOR_CORRECT: "Correct only the diagnosed hair color property; preserve all facial and photographic properties.",
    BEARD_CORRECT: "Correct only the diagnosed beard/facial-hair property; preserve the complete face and hairstyle.",
    ARTIFACT_REMOVE: "Remove only the diagnosed rendering artifact while preserving the generated hairstyle and all passing properties.",
  };
  return base + "\n\nTARGETED STRATEGY: " + map[strategy] + "\n\nQA DIAGNOSIS: " + defect;
}

export function decideAdaptiveRefinement(input: { defect: string; qa: any; history: AdaptiveAttempt[]; attemptNumber: number; maxAttempts: number; currentPrompt?: string | null; currentPromptRevision?: string | null; currentArtifactId?: string | null; currentAiGatePassed?: boolean | null }): AdaptiveDecision {
  const classified = classifyDefect(input.defect);
  // The report route's history query also includes the reserved in-flight row for
  // this attempt. Exclude it so it cannot be mistaken for prior evidence.
  const history = input.history.filter((attempt) => attempt.attemptNumber < input.attemptNumber);
  const priorStrategies = history.map((a) => parseStrategy(a.refinementReason, a.adaptiveDecision)).filter(Boolean) as AdaptiveStrategy[];
  const { improvedDimensions, regressedDimensions } = compareScores(input.qa, history);
  const regression = regressionDetected(input.qa, history, regressedDimensions);
  const previousAttempt = [...history].sort((a, b) => b.attemptNumber - a.attemptNumber)[0];
  const evidence: AdaptiveDecision["evidence"] = {
    comparedAttemptNumbers: history.map((a) => a.attemptNumber),
    priorAttempts: history.map((attempt) => ({
      attemptNumber: attempt.attemptNumber,
      scores: scoreSnapshot(attempt.qaJson),
      gates: gateSnapshot(attempt.qaJson, attempt.aiGatePassed),
      verdict: attempt.verdict,
      defect: typeof attempt.qaJson?.refinement === "string" ? attempt.qaJson.refinement : attempt.refinementReason,
      strategy: parseStrategy(attempt.refinementReason, attempt.adaptiveDecision),
      promptRevision: attempt.promptRevision ?? null,
      artifactId: attempt.artifactId ?? null,
    })),
    current: {
      attemptNumber: input.attemptNumber,
      scores: scoreSnapshot(input.qa),
      gates: gateSnapshot(input.qa, input.currentAiGatePassed ?? null),
      verdict: typeof input.qa?.verdict === "string" ? input.qa.verdict : "UNKNOWN",
      defect: input.defect,
      promptRevision: input.currentPromptRevision ?? null,
      artifactId: input.currentArtifactId ?? null,
      promptChangedFromPrevious: previousAttempt?.prompt != null && input.currentPrompt != null
        ? previousAttempt.prompt !== input.currentPrompt
        : null,
    },
    improvedDimensions,
    regressedDimensions,
  };
  const sameCategory = history.filter((attempt) =>
    parseCategory(attempt.adaptiveDecision) === classified.category ||
    classifyDefect(typeof attempt.qaJson?.refinement === "string" ? attempt.qaJson.refinement : attempt.refinementReason ?? "").category === classified.category,
  );
  const priorScores = sameCategory.map((a) => targetScore(a.qaJson, classified.category)).filter((v): v is number => v != null);
  const currentScore = targetScore(input.qa, classified.category);
  const bestPrior = priorScores.length ? Math.max(...priorScores) : null;
  const plateau = sameCategory.length >= 2 && currentScore != null && bestPrior != null && currentScore - bestPrior < 0.5;

  if (regression || classified.category === "UNKNOWN") {
    return { action: "HUMAN_REVIEW", category: classified.category, property: classified.property, strategy: null, instruction: null,
      reason: regression ? "Regression detected in a protected QA property." : "QA defect could not be mapped safely to one property.",
      regression, plateau, priorStrategies, evidence };
  }
  if (input.attemptNumber >= input.maxAttempts) {
    return { action: "EXHAUSTED", category: classified.category, property: classified.property, strategy: null, instruction: null,
      reason: "Autonomous attempt ceiling reached.", regression, plateau, priorStrategies, evidence };
  }
  const compatibleStrategies = strategiesFor(classified.category, classified.direction);
  const progress = currentScore != null && bestPrior != null && currentScore - bestPrior >= 0.5;
  const lastStrategy = priorStrategies[priorStrategies.length - 1] ?? null;
  const strategy = progress && lastStrategy && compatibleStrategies.includes(lastStrategy)
    ? lastStrategy
    : compatibleStrategies.find((candidate) => !priorStrategies.includes(candidate)) ?? null;
  if (!strategy) {
    return { action: "HUMAN_REVIEW", category: classified.category, property: classified.property, strategy: null, instruction: null,
      reason: "No untried bounded strategy remains for this repeated defect.", regression, plateau, priorStrategies, evidence };
  }
  const reason = JSON.stringify({ category: classified.category, property: classified.property, strategy, regression, plateau });
  return { action: "REFINE", category: classified.category, property: classified.property, strategy,
    instruction: makeInstruction(strategy, input.defect), reason: "ADAPTIVE_DECISION:" + reason, regression, plateau, priorStrategies, evidence };
}
