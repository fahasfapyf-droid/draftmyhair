export type AdaptiveAction = "REFINE" | "HUMAN_REVIEW" | "EXHAUSTED";
export type DefectCategory = "VOLUME" | "SILHOUETTE" | "LENGTH" | "TEXTURE" | "ROOT" | "COLOR" | "BEARD" | "ARTIFACT" | "UNKNOWN";
export type AdaptiveStrategy =
  | "VOLUME_INCREASE_LOCALIZED" | "VOLUME_REDUCE_EXCESS"
  | "SILHOUETTE_STRENGTHEN_INWARD_CONTOUR" | "SILHOUETTE_REDUCE_EXCESS_ROUNDING"
  | "LENGTH_CORRECT" | "TEXTURE_CORRECT" | "ROOT_INTEGRATION_CORRECT"
  | "COLOR_CORRECT" | "BEARD_CORRECT" | "ARTIFACT_REMOVE";

export type AdaptiveAttempt = {
  attemptNumber: number;
  overallScore: number | null;
  aiGatePassed: boolean | null;
  verdict: string;
  refinementReason: string | null;
  qaJson: any;
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
};

function classifyDefect(defect: string): { category: DefectCategory; property: string; direction: "increase" | "reduce" | "correct" } {
  const d = defect.toLowerCase();
  const increase = /(insufficient|too little|needs more|lack(?:s|ing)?|weak|under|not enough|more weight|more volume|more density)/.test(d);
  const reduce = /(excess|too much|overly|too heavy|too wide|too rounded|too bulky|too dense|reduce|less volume)/.test(d);
  if (/(volume|weight|density|fullness|body)/.test(d)) return { category: "VOLUME", property: "hair volume/weight", direction: increase ? "increase" : reduce ? "reduce" : "correct" };
  if (/(silhouette|contour|curve|curvature|rounded|straight side|inward|shape)/.test(d)) return { category: "SILHOUETTE", property: "hair silhouette/contour", direction: reduce ? "reduce" : increase ? "increase" : "correct" };
  if (/(length|jaw[- ]?length|chin|nape|shorter|longer)/.test(d)) return { category: "LENGTH", property: "hair length", direction: "correct" };
  if (/(texture|wave|curl|strand|sleek|rough|frizz)/.test(d)) return { category: "TEXTURE", property: "hair texture", direction: "correct" };
  if (/(root|scalp|hairline|integration|blend)/.test(d)) return { category: "ROOT", property: "root/scalp integration", direction: "correct" };
  if (/(color|colour|tone|dye|shade)/.test(d)) return { category: "COLOR", property: "hair color", direction: "correct" };
  if (/(beard|facial hair|mustache|moustache)/.test(d)) return { category: "BEARD", property: "beard/facial hair", direction: "correct" };
  if (/(artifact|artefact|halo|seam|ghost|duplicate|warping)/.test(d)) return { category: "ARTIFACT", property: "rendering artifact", direction: "correct" };
  return { category: "UNKNOWN", property: "unknown property", direction: "correct" };
}

function strategyFor(category: DefectCategory, direction: ReturnType<typeof classifyDefect>["direction"]): AdaptiveStrategy | null {
  if (category === "VOLUME") return direction === "reduce" ? "VOLUME_REDUCE_EXCESS" : "VOLUME_INCREASE_LOCALIZED";
  if (category === "SILHOUETTE") return direction === "reduce" ? "SILHOUETTE_REDUCE_EXCESS_ROUNDING" : "SILHOUETTE_STRENGTHEN_INWARD_CONTOUR";
  if (category === "LENGTH") return "LENGTH_CORRECT";
  if (category === "TEXTURE") return "TEXTURE_CORRECT";
  if (category === "ROOT") return "ROOT_INTEGRATION_CORRECT";
  if (category === "COLOR") return "COLOR_CORRECT";
  if (category === "BEARD") return "BEARD_CORRECT";
  if (category === "ARTIFACT") return "ARTIFACT_REMOVE";
  return null;
}
function parseStrategy(reason: string | null): AdaptiveStrategy | null {
  if (!reason) return null;
  const marker = "ADAPTIVE_DECISION:";
  const index = reason.indexOf(marker);
  if (index < 0) return null;
  try {
    const parsed = JSON.parse(reason.slice(index + marker.length).trim());
    return typeof parsed.strategy === "string" ? parsed.strategy as AdaptiveStrategy : null;
  } catch { return null; }
}

function scoreOf(qa: any, key: string) {
  const value = Number(qa?.[key]);
  return Number.isFinite(value) ? value : null;
}

function regressionDetected(current: any, history: AdaptiveAttempt[]) {
  const protectedKeys = ["overall", "identity", "hairstyleAccuracy", "rootIntegration", "lighting", "color"];
  for (const key of protectedKeys) {
    const currentScore = scoreOf(current, key);
    if (currentScore == null) continue;
    const best = Math.max(...history.map((a) => scoreOf(a.qaJson, key) ?? -Infinity));
    if (Number.isFinite(best) && best - currentScore >= 0.5) return true;
  }
  const priorPass = history.some((a) => a.aiGatePassed === true);
  if (priorPass && current?.transformationGate?.passed === false) return true;
  const priorArtifactsClear = history.some((a) => a.qaJson?.artifacts === "NONE");
  if (priorArtifactsClear && current?.artifacts === "FOUND") return true;
  return false;
}

function targetScore(qa: any, category: DefectCategory) {
  if (category === "VOLUME" || category === "SILHOUETTE" || category === "LENGTH" || category === "TEXTURE") return scoreOf(qa, "hairstyleAccuracy");
  if (category === "ROOT") return scoreOf(qa, "rootIntegration");
  if (category === "COLOR") return scoreOf(qa, "color");
  if (category === "BEARD") return scoreOf(qa, "beard");
  if (category === "ARTIFACT") return qa?.artifacts === "NONE" ? 10 : 0;
  return scoreOf(qa, "overall");
}
function makeInstruction(strategy: AdaptiveStrategy, defect: string) {
  const base = "Apply exactly one targeted correction to the diagnosed property. Preserve identity, face, ears, skull geometry, lighting, framing, background, color balance, and every previously passing property.";
  const map: Record<AdaptiveStrategy, string> = {
    VOLUME_INCREASE_LOCALIZED: "Increase only the missing local hair volume/weight where QA identified insufficiency; do not enlarge unrelated areas.",
    VOLUME_REDUCE_EXCESS: "Reduce only the excessive hair volume/weight identified by QA; do not flatten unrelated areas.",
    SILHOUETTE_STRENGTHEN_INWARD_CONTOUR: "Strengthen only the diagnosed silhouette/contour correction, especially the required inward curve, without changing length or unrelated volume.",
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

export function decideAdaptiveRefinement(input: { defect: string; qa: any; history: AdaptiveAttempt[]; attemptNumber: number; maxAttempts: number }): AdaptiveDecision {
  const classified = classifyDefect(input.defect);
  const priorStrategies = input.history.map((a) => parseStrategy(a.refinementReason)).filter(Boolean) as AdaptiveStrategy[];
  const regression = regressionDetected(input.qa, input.history);
  const sameCategory = input.history.filter((a) => classifyDefect(a.refinementReason ?? "").category === classified.category);
  const priorScores = sameCategory.map((a) => targetScore(a.qaJson, classified.category)).filter((v): v is number => v != null);
  const currentScore = targetScore(input.qa, classified.category);
  const bestPrior = priorScores.length ? Math.max(...priorScores) : null;
  const plateau = sameCategory.length >= 2 && currentScore != null && bestPrior != null && currentScore - bestPrior < 0.5;

  if (regression || classified.category === "UNKNOWN") {
    return { action: "HUMAN_REVIEW", category: classified.category, property: classified.property, strategy: null, instruction: null,
      reason: regression ? "Regression detected in a protected QA property." : "QA defect could not be mapped safely to one property.",
      regression, plateau, priorStrategies };
  }
  if (input.attemptNumber >= input.maxAttempts) {
    return { action: "EXHAUSTED", category: classified.category, property: classified.property, strategy: null, instruction: null,
      reason: "Autonomous attempt ceiling reached.", regression, plateau, priorStrategies };
  }
  const strategy = strategyFor(classified.category, classified.direction);
  if (!strategy || (priorStrategies.includes(strategy) && plateau)) {
    return { action: "HUMAN_REVIEW", category: classified.category, property: classified.property, strategy: null, instruction: null,
      reason: "No untried bounded strategy remains for a repeated defect.", regression, plateau, priorStrategies };
  }
  const reason = JSON.stringify({ category: classified.category, property: classified.property, strategy, regression, plateau });
  return { action: "REFINE", category: classified.category, property: classified.property, strategy,
    instruction: makeInstruction(strategy, input.defect), reason: "ADAPTIVE_DECISION:" + reason, regression, plateau, priorStrategies };
}
