import assert from "node:assert/strict";
import test from "node:test";
import { optimizeAutonomousPrompt } from "@/lib/rnd/autonomous-prompt";
import { resolvePersistedRefinementPrompt } from "@/lib/rnd/claim-prompt";

const TEXTURE_STRATEGIES = [
  {
    id: "TEXTURE_MATCH_DEFINITION",
    instruction:
      "Correct only hair texture to the authoritative hairstyle definition; preserve shape, length, and all other properties.",
  },
  {
    id: "TEXTURE_REFINE_STRUCTURE",
    instruction:
      "Refine only the diagnosed hair texture structure to the authoritative definition; preserve shape, length, and all other properties.",
  },
];

test("texture refinements preserve root integration and all passing properties", async () => {
  for (const strategy of TEXTURE_STRATEGIES) {
    const result = await optimizeAutonomousPrompt({
      instruction: "Italian Bob",
      currentPrompt: "Existing generation prompt",
      defect: strategy.instruction,
      attemptNumber: 1,
      authoritativeStylePrompt: "Authoritative Italian Bob definition.",
      strategyId: strategy.id,
    });

    assert.match(result.prompt, /TEXTURE-ONLY PRESERVATION BOUNDARY/);
    assert.match(result.prompt, /hairline contour, scalp visibility/);
    assert.match(result.prompt, /root-to-scalp contact and transition, and edge blending exactly/);
    assert.match(result.prompt, /shape, length, silhouette, volume, styling, hair color/);
  }
});

test("claim reuses the report-time validated texture prompt verbatim", async () => {
  const strategy = TEXTURE_STRATEGIES[0];
  const decision = {
    action: "REFINE",
    category: "TEXTURE",
    property: "hair texture",
    strategy: strategy.id,
    instruction: strategy.instruction,
  };
  const reportPrompt = (await optimizeAutonomousPrompt({
    instruction: "Italian Bob",
    currentPrompt: "Existing generation prompt",
    defect: strategy.instruction,
    attemptNumber: 2,
    authoritativeStylePrompt: "Report-time authority.",
    strategyId: strategy.id,
  })).prompt;
  const claimed = resolvePersistedRefinementPrompt({ persistedPrompt: reportPrompt, adaptiveDecision: decision });
  assert.strictEqual(claimed, reportPrompt);
  assert.ok(claimed?.includes("TEXTURE-ONLY PRESERVATION BOUNDARY"));
});

test("claim rejects an invalid or incomplete persisted texture prompt", async () => {
  const strategy = TEXTURE_STRATEGIES[0];
  const decision = {
    action: "REFINE", category: "TEXTURE", property: "hair texture",
    strategy: strategy.id, instruction: strategy.instruction,
  };
  const invalid = "# TARGETED REFINEMENT\n" + strategy.instruction;
  assert.strictEqual(resolvePersistedRefinementPrompt({ persistedPrompt: invalid, adaptiveDecision: decision }), null);
});
