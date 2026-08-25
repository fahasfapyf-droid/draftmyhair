import { Prisma } from "@prisma/client";

import { MASTER_PROMPT } from "../prompts/master";
import { MASTER_PROMPT_V2 } from "../prompts/master-v2";
import { MASTER_PROMPT_V3 } from "../prompts/master-v3";
import { MASTER_PROMPT_V3_SINGLE } from "../prompts/master-v3-single";
import { STYLE_PROMPTS } from "../prompts/styles";
import { prisma } from "@/lib/prisma";
import { PromptBuildRequest, PromptBuildResult } from "../types";

const ACTIVE_PROMPT_VERSION = process.env.PROMPT_VERSION?.toLowerCase() ?? "v3-single";

function getCompiledMasterPrompt(): string {
  switch (ACTIVE_PROMPT_VERSION) {
    case "v1": return MASTER_PROMPT;
    case "v2": return MASTER_PROMPT_V2;
    case "v3": return MASTER_PROMPT_V3;
    case "v3-single": return MASTER_PROMPT_V3_SINGLE;
    default: throw new Error(`Unknown PROMPT_VERSION: ${ACTIVE_PROMPT_VERSION}`);
  }
}

async function getMasterPrompt() {
  const environment = process.env.VERCEL_ENV === "production" ? "PRODUCTION" : "PREVIEW";

  try {
    const rows = await prisma.$queryRaw<{ prompt: string; version: number }[]>(Prisma.sql`
      SELECT "prompt", "version"
      FROM "MasterPromptVersion"
      WHERE "environment" = ${environment}::"MasterPromptEnvironment" AND "status" = 'ACTIVE'
      ORDER BY "version" DESC
      LIMIT 1
    `);

    if (rows[0]) {
      return { prompt: rows[0].prompt, source: `database-${environment.toLowerCase()}-v${rows[0].version}` };
    }
  } catch (error) {
    // The compiled prompt remains the safe fallback if the optional override table
    // is unavailable during rollout or in an environment that has not migrated yet.
    console.warn("[PROMPT_PROVENANCE] Master prompt DB override unavailable; using compiled prompt.", error);
  }

  return { prompt: getCompiledMasterPrompt(), source: `compiled-${ACTIVE_PROMPT_VERSION}` };
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

  const master = await getMasterPrompt();
  const prompt = `${master.prompt}\n\n------------------------------------------------------------\n\n# REQUESTED HAIRSTYLE\n\n${stylePrompt}`.trim();

  const diagnostics = {
    promptKey: request.promptKey,
    masterPromptVersion: master.source,
    stylePromptSource: databaseStyle ? `database-v${databaseStyle.version}` : "compiled",
    stylePromptLength: stylePrompt.length,
    finalPromptLength: prompt.length,
  };

  console.log("[PROMPT_PROVENANCE]", JSON.stringify(diagnostics));

  return { prompt, diagnostics };
}
