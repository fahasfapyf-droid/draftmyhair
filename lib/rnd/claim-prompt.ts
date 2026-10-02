const VALID_STRATEGIES = new Set([
  "VOLUME_INCREASE_LOCALIZED", "VOLUME_DENSITY_REINFORCE", "VOLUME_REDUCE_EXCESS", "VOLUME_COMPACT_REDUCE",
  "SILHOUETTE_STRENGTHEN_INWARD_CONTOUR", "SILHOUETTE_TIGHTEN_JAW_CONTOUR", "SILHOUETTE_REDUCE_EXCESS_ROUNDING",
  "LENGTH_CORRECT", "TEXTURE_MATCH_DEFINITION", "TEXTURE_REFINE_STRUCTURE", "ROOT_INTEGRATION_CORRECT",
  "COLOR_CORRECT", "BEARD_CORRECT", "ARTIFACT_REMOVE",
]);

const TEXTURE_STRATEGIES = new Set(["TEXTURE_MATCH_DEFINITION", "TEXTURE_REFINE_STRUCTURE"]);

export function resolvePersistedRefinementPrompt(input: {
  persistedPrompt: string;
  adaptiveDecision: unknown;
}) {
  const decision = input.adaptiveDecision && typeof input.adaptiveDecision === "object"
    ? input.adaptiveDecision as Record<string, unknown>
    : null;
  const strategy = typeof decision?.strategy === "string" ? decision.strategy : null;
  const instruction = typeof decision?.instruction === "string" ? decision.instruction.trim() : null;
  const category = typeof decision?.category === "string" ? decision.category : null;
  const property = typeof decision?.property === "string" ? decision.property : null;
  const marker = input.persistedPrompt.includes("# TARGETED REFINEMENT");
  const exactInstruction = Boolean(instruction && input.persistedPrompt.endsWith(instruction));
  const canonicalStrategy = Boolean(strategy && VALID_STRATEGIES.has(strategy));
  const validCategory = category !== null && category !== "UNKNOWN";
  const validProperty = Boolean(property);
  const textureBoundary = !TEXTURE_STRATEGIES.has(strategy ?? "") || (
    input.persistedPrompt.includes("TEXTURE-ONLY PRESERVATION BOUNDARY") &&
    input.persistedPrompt.includes("hairline contour, scalp visibility, follicular and root density, root-to-scalp contact and transition, and edge blending exactly") &&
    input.persistedPrompt.includes("shape, length, silhouette, volume, styling, hair color, and every other passing property.")
  );

  return marker && exactInstruction && canonicalStrategy && validCategory && validProperty && textureBoundary
    ? input.persistedPrompt
    : null;
}
