import assert from "node:assert/strict";
import test from "node:test";
import { optimizeAutonomousPrompt } from "@/lib/rnd/autonomous-prompt";

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
