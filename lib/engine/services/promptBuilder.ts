import { MASTER_PROMPT } from "../prompts/master";
import { MASTER_PROMPT_V2 } from "../prompts/master-v2";
import { MASTER_PROMPT_V3 } from "../prompts/master-v3";
import { MASTER_PROMPT_V3_SINGLE } from "../prompts/master-v3-single";
import { POSE_PROMPT } from "../prompts/pose";
import { STYLE_PROMPTS } from "../prompts/styles";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
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

type ActivePosePromptRow = {
  name: string;
  slug: string;
  version: number;
  prompt: string;
};

async function getActivePosePrompt(): Promise<ActivePosePromptRow | null> {
  const rows = await prisma.$queryRaw<ActivePosePromptRow[]>(Prisma.sql`
    SELECT "name", "slug", "version", "prompt"
    FROM "PosePromptVersion"
    WHERE "status" = 'ACTIVE'
    ORDER BY "version" DESC
    LIMIT 1
  `);

  return rows[0] ?? null;
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
  const activePosePrompt = await getActivePosePrompt();

  // IMPORTANT: with no ACTIVE pose prompt, this produces the exact same final
  // prompt structure as before this feature. The new layer is therefore opt-in
  // through the existing admin prompt status rather than silently changing the
  // production generation behavior.
  const poseSection = activePosePrompt
    ? `\n\n------------------------------------------------------------\n\n# POSE & CAMERA OPTIMIZATION\n\n${activePosePrompt.prompt}`
    : "";

  const prompt = `${masterPrompt}${poseSection}\n\n------------------------------------------------------------\n\n# REQUESTED HAIRSTYLE\n\n${stylePrompt}`.trim();

  if (DEBUG_PROMPTS) console.debug("Prompt build diagnostics", {
    version: ACTIVE_PROMPT_VERSION,
    stylePromptSource: databaseStyle ? `database-v${databaseStyle.version}` : "compiled",
    posePromptSource: activePosePrompt ? `database:${activePosePrompt.slug}-v${activePosePrompt.version}` : "none",
    posePromptVersion: activePosePrompt?.version ?? null,
    compiledPosePromptVersion: POSE_PROMPT ? "available" : "missing",
    masterPromptLength: masterPrompt.length,
    finalPromptLength: prompt.length,
  });

  return { prompt };
}
