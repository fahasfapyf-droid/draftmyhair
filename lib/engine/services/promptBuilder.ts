import { MASTER_PROMPT } from "../prompts/master";
import { STYLE_PROMPTS } from "../prompts/styles";

import {
  PromptBuildRequest,
  PromptBuildResult,
} from "../types";

/**
 * ============================================================
 * Draft My Hair
 * Prompt Builder Service
 * ============================================================
 *
 * Combines:
 *
 * - Master Prompt
 * - Hairstyle Prompt
 *
 * into one production prompt.
 */

export function buildPrompt(
  request: PromptBuildRequest
): PromptBuildResult {
  const style = STYLE_PROMPTS[request.promptKey];

  if (!style) {
    throw new Error(
      `Unknown hairstyle prompt key: ${request.promptKey}`
    );
  }

  const prompt = `
${MASTER_PROMPT}

------------------------------------------------------------

# HAIRSTYLE

${style.prompt}
`.trim();

  return {
    prompt,
  };
}
