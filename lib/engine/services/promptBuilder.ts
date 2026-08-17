import { prisma } from "@/lib/prisma";
import { MASTER_PROMPT } from "../prompts/master";
import { MASTER_PROMPT_V2 } from "../prompts/master-v2";
import { MASTER_PROMPT_V3 } from "../prompts/master-v3";
import { MASTER_PROMPT_V3_SINGLE } from "../prompts/master-v3-single";
import { STYLE_PROMPTS } from "../prompts/styles";
import { PromptBuildRequest, PromptBuildResult } from "../types";

const ACTIVE_PROMPT_VERSION = process.env.PROMPT_VERSION?.toLowerCase() ?? "v3";
const DEBUG_PROMPTS = process.env.DEBUG_PROMPTS === "true";

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
  const style = STYLE_PROMPTS[request.promptKey];
  const databasePrompt = await prisma.stylePrompt.findFirst({
    where: {
      hairstyle: { promptKey: request.promptKey },
      isActive: true,
      qaStatus: { in: ["QA_PASSED", "PUBLISHED"] },
    },
    orderBy: { updatedAt: "desc" },
    select: { prompt: true, version: true },
  });

  if (!style && !databasePrompt) {
    throw new Error(`Unknown hairstyle prompt key: ${request.promptKey}`);
  }

  const stylePrompt = databasePrompt?.prompt ?? style!.prompt;
  const styleVersion = databasePrompt?.version ?? "code";
  const masterPrompt = getMasterPrompt();
  const prompt = `${masterPrompt}\n\n------------------------------------------------------------\n\n# REQUESTED HAIRSTYLE\n\n${stylePrompt}`.trim();
  const promptVersion = `${ACTIVE_PROMPT_VERSION}:${styleVersion}`;

  if (DEBUG_PROMPTS) {
    console.debug("Prompt build diagnostics", {
      version: promptVersion,
      masterPromptLength: masterPrompt.length,
      finalPromptLength: prompt.length,
      source: databasePrompt ? "database" : "code",
    });
  }

  return { prompt, promptVersion };
}
