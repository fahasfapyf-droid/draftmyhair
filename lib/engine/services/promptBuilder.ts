import { MASTER_PROMPT } from "../prompts/master";
import { MASTER_PROMPT_V2 } from "../prompts/master-v2";
import { MASTER_PROMPT_V3 } from "../prompts/master-v3";
import { MASTER_PROMPT_V3_SINGLE } from "../prompts/master-v3-single";
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
 * Supported prompt engines:
 *
 * - v1
 * - v2
 * - v3
 * - v3-single
 * ============================================================
 */

const ACTIVE_PROMPT_VERSION =
  process.env.PROMPT_VERSION?.toLowerCase() ?? "v3";

function getMasterPrompt(): string {
  console.log("");
  console.log("==========================================================");
  console.log("              PROMPT BUILDER DEBUG");
  console.log("==========================================================");
  console.log("Environment PROMPT_VERSION:");
  console.log(process.env.PROMPT_VERSION);
  console.log("");
  console.log("ACTIVE_PROMPT_VERSION:");
  console.log(ACTIVE_PROMPT_VERSION);

  switch (ACTIVE_PROMPT_VERSION) {
    case "v1":
      console.log("");
      console.log(">>> USING MASTER_PROMPT (V1)");
      console.log("==========================================================");
      return MASTER_PROMPT;

    case "v2":
      console.log("");
      console.log(">>> USING MASTER_PROMPT_V2");
      console.log("==========================================================");
      return MASTER_PROMPT_V2;

    case "v3":
      console.log("");
      console.log(">>> USING MASTER_PROMPT_V3");
      console.log("==========================================================");
      return MASTER_PROMPT_V3;

    case "v3-single":
      console.log("");
      console.log(">>> USING MASTER_PROMPT_V3_SINGLE");
      console.log("==========================================================");
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

  console.log("");
  console.log("Master Prompt Length:");
  console.log(masterPrompt.length);

  console.log("");
  console.log("Master Prompt Start:");
  console.log("--------------------------------");
  console.log(masterPrompt.substring(0, 300));

  console.log("");

  const prompt = `
${masterPrompt}

------------------------------------------------------------

# REQUESTED HAIRSTYLE

${style.prompt}
`.trim();

  console.log("Final Prompt Length:");
  console.log(prompt.length);

  console.log("==========================================================");
  console.log("");

  return {
    prompt,
  };
}