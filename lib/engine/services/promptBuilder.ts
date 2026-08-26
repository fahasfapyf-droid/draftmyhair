import { MASTER_PROMPT } from "../prompts/master";
import { MASTER_PROMPT_V2 } from "../prompts/master-v2";
import { MASTER_PROMPT_V3 } from "../prompts/master-v3";
import { MASTER_PROMPT_V3_SINGLE } from "../prompts/master-v3-single";
import { STYLE_PROMPTS } from "../prompts/styles";
import { prisma } from "@/lib/prisma";
import { PromptBuildRequest, PromptBuildResult } from "../types";

// Preview-only experiment. Production remains master + style.
const ACTIVE_PROMPT_VERSION = process.env.PROMPT_VERSION?.toLowerCase() ?? "v3-single";
const PREVIEW_STYLE_PROMPT_ONLY = true;

function getMasterPrompt(): string {
  switch (ACTIVE_PROMPT_VERSION) {
    case "v1": return MASTER_PROMPT;
    case "v2": return MASTER_PROMPT_V2;
    case "v3": return MASTER_PROMPT_V3;
    case "v3-single": return MASTER_PROMPT_V3_SINGLE;
    default: throw new Error(`Unknown PROMPT_VERSION: ${ACTIVE_PROMPT_VERSION}`);
  }
}

export async function buildPrompt(request: PromptBuildRequest): Promise<PromptBuildResult> {
  const databaseStyle = await prisma.promptVersion.findFirst({
    where: { status: "ACTIVE", hairstyle: { promptKey: request.promptKey, isActive: true } },
    orderBy: { version: "desc" },
    select: { prompt: true, version: true },
  });
  const compiledStyle = STYLE_PROMPTS[request.promptKey];
  const stylePrompt = databaseStyle?.prompt ?? compiledStyle?.prompt;
  if (!stylePrompt) throw new Error(`Unknown hairstyle prompt key: ${request.promptKey}`);

  const masterPrompt = getMasterPrompt();
  const stylePromptSource = databaseStyle
    ? `database-v${databaseStyle.version}`
    : "compiled";

  const prompt = PREVIEW_STYLE_PROMPT_ONLY
    ? stylePrompt.trim()
    : `${masterPrompt}\n\n------------------------------------------------------------\n\n# REQUESTED HAIRSTYLE\n\n${stylePrompt}`.trim();

  const diagnostics = {
    promptKey: request.promptKey,
    masterPromptVersion: PREVIEW_STYLE_PROMPT_ONLY ? "style-only-preview" : ACTIVE_PROMPT_VERSION,
    stylePromptSource,
    stylePromptLength: stylePrompt.length,
    finalPromptLength: prompt.length,
  };

  console.log("[PROMPT_PROVENANCE]", JSON.stringify(diagnostics));

  return { prompt, diagnostics };
}
