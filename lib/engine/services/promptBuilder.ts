import { MASTER_PROMPT } from "../prompts/master";
import { MASTER_PROMPT_V2 } from "../prompts/master-v2";
import { MASTER_PROMPT_V3 } from "../prompts/master-v3";
import { MASTER_PROMPT_V3_SINGLE } from "../prompts/master-v3-single";
import { STYLE_PROMPTS } from "../prompts/styles";

import {
  PromptBuildRequest,
  PromptBuildResult,
} from "../types";

const ACTIVE_PROMPT_VERSION =
  process.env.PROMPT_VERSION?.toLowerCase() ?? "v3";
const DEBUG_PROMPTS = process.env.DEBUG_PROMPTS === "true";

function getMasterPrompt(): string {
  switch (ACTIVE_PROMPT_VERSION) {
    case "v1":
      return MASTER_PROMPT;
    case "v2":
      return MASTER_PROMPT_V2;
    case "v3":
      return MASTER_PROMPT_V3;
    case "v3-single":
      return MASTER_PROMPT_V3_SINGLE;
    default:
      throw new Error(
        `Unknown PROMPT_VERSION: ${ACTIVE_PROMPT_VERSION}`
      );
  }
}

export function buildPrompt(
  request: PromptBuildRequest
): PromptBuildResult {
  const style = STYLE_PROMPTS[request.promptKey];

  if (!style) {
    throw new Error(
      `Unknown hairstyle prompt key: ${request.promptKey}`
    );
  }

  const masterPrompt = getMasterPrompt();

  const prompt = `
${masterPrompt}

------------------------------------------------------------

# REQUESTED HAIRSTYLE

${style.prompt}
`.trim();

  if (DEBUG_PROMPTS) {
    console.debug("Prompt build diagnostics", {
      version: ACTIVE_PROMPT_VERSION,
      masterPromptLength: masterPrompt.length,
      finalPromptLength: prompt.length,
    });
  }

  return { prompt };
}
