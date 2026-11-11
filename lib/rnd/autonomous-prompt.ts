import { recallRndPlanningEvidence, formatRndPlanningEvidence, hindsightEnabled } from "@/lib/rnd/hindsight";
import { requestResearchPlan, formatResearchPlan } from "@/lib/rnd/research-planner";
import { unsafeResearchText } from "@/lib/rnd/bounded-json";
import { GoogleGenAI } from "@google/genai";
import { MASTER_PROMPT } from "@/lib/engine/prompts/master";
import { MASTER_PROMPT_V2 } from "@/lib/engine/prompts/master-v2";
import { MASTER_PROMPT_V3 } from "@/lib/engine/prompts/master-v3";
import { MASTER_PROMPT_V3_SINGLE } from "@/lib/engine/prompts/master-v3-single";

type ModelResult = { stylePrompt: string; revisionNote: string };

function getMasterPrompt() {
  switch ((process.env.PROMPT_VERSION?.toLowerCase() ?? "v3-single")) {
    case "v1": return MASTER_PROMPT;
    case "v2": return MASTER_PROMPT_V2;
    case "v3": return MASTER_PROMPT_V3;
    case "v3-single": return MASTER_PROMPT_V3_SINGLE;
    default: throw new Error("Unknown PROMPT_VERSION.");
  }
}

function getClient() {
  const project = process.env.GOOGLE_CLOUD_PROJECT_ID;
  const location = process.env.GOOGLE_CLOUD_LOCATION;
  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!project || !location || !serviceAccountJson) throw new Error("Vertex prompt engine is not configured.");
  let credentials: Record<string, unknown>;
  try { credentials = JSON.parse(serviceAccountJson); } catch { throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON contains invalid JSON."); }
  return new GoogleGenAI({ vertexai: true, project, location, googleAuthOptions: { credentials } });
}

const OUTPUT_SCHEMA = {
  type: "OBJECT",
  properties: {
    stylePrompt: { type: "STRING" },
    revisionNote: { type: "STRING" },
  },
  required: ["stylePrompt", "revisionNote"],
  propertyOrdering: ["stylePrompt", "revisionNote"],
} as const;

const SYSTEM = [
  "You are Draft My Hair's autonomous hairstyle prompt engineer.",
  "The human supplies only the hairstyle objective. You own the style-specific prompt engineering.",
  "Return ONLY the requested hairstyle's STYLE-SPECIFIC PROMPT BLOCK. Do not reproduce the master prompt.",
  "The application will deterministically prepend the immutable master prompt.",
  "Make the requested hairstyle visually unambiguous using concrete salon geometry: length, silhouette, weight distribution, perimeter, layering, texture, direction, styling, and distinguishing characteristics.",
  "Explicitly distinguish the requested style from nearby/confusable styles when that reduces model ambiguity.",
  "Be decisive and concrete. Do not add generic self-check lists or hedging.",
  "Never instruct the image model to regenerate the face, skin, ears, neck, skull, background, pose, framing, lighting, or body.",
  "For non-dye styles, preserve the original hair color through the existing master root-authority system; do not invent a new color.",
  "For refinement, preserve every previously passing style requirement and modify only what is necessary to address the supplied QA defect.",
  "Return JSON only.",
].join("\n");

async function callModel(instruction: string, currentStylePrompt?: string, defect?: string, advisory = ""): Promise<ModelResult> {
  const ai = getClient();
  const task = currentStylePrompt
    ? [
        "OPTIMIZATION TASK.",
        "Human objective:", instruction,
        "Current style-specific prompt block:", currentStylePrompt,
        "Automated QA defect diagnosis:", defect ?? "Improve the most important remaining transformation defect.",
        "Rewrite the STYLE-SPECIFIC BLOCK only.",
        "Preserve every passing requirement from the current block.",
        "Change only the language necessary to correct the diagnosed defect.",
      ].join("\n\n")
    : [
        "INITIAL PROMPT TASK.",
        "Human objective:", instruction,
        "Create the strongest possible style-specific block for the requested hairstyle.",
      ].join("\n\n");

  const response = await ai.models.generateContent({
    model: process.env.RND_PROMPT_MODEL ?? "gemini-2.5-flash",
    contents: [{
      role: "user",
      parts: [{ text: SYSTEM + "\n\n" + task + (advisory ? "\n\n" + advisory : "") }],
    }],
    config: {
      httpOptions: { timeout: 15000 },
      responseMimeType: "application/json",
      responseSchema: OUTPUT_SCHEMA,
      maxOutputTokens: 4096,
    },
  });

  const raw = response.text ?? response.candidates?.[0]?.content?.parts?.map(p => p.text ?? "").join("") ?? "";
  if (!raw) throw new Error("Prompt model returned an empty response.");
  const result = JSON.parse(raw) as ModelResult;
  if (typeof result.stylePrompt !== "string" || result.stylePrompt.trim().length < 80 || result.stylePrompt.length > 12000 || !isSafeRndStyleBlock(result.stylePrompt, instruction)) {
    throw new Error("Prompt model returned an invalid style-specific prompt.");
  }
  return { stylePrompt: result.stylePrompt.trim(), revisionNote: typeof result.revisionNote === "string" && !unsafeResearchText(result.revisionNote) ? result.revisionNote.trim().slice(0,400) : "" };
}

function compile(stylePrompt: string) {
  const prompt = [
    getMasterPrompt().trim(),
    "",
    "------------------------------------------------------------",
    "",
    "# REQUESTED HAIRSTYLE",
    "",
    stylePrompt.trim(),
  ].join("\n").trim();
  const master = getMasterPrompt();
  if (!master.includes("Modify only the hair.") || !master.includes("IDENTITY LOCK")) {
    throw new Error("Master prompt compilation failed.");
  }
  return prompt;
}

export async function generateAutonomousPrompt(instruction: string, context: { targetKey: string } = { targetKey: "unspecified" }) {
  const clean = instruction.trim();
  if (!clean || clean.length > 4000 || context.targetKey.length > 128 || unsafeResearchText(clean)) throw new Error("Invalid human hairstyle objective.");
  const [history, research] = await Promise.all([recallRndPlanningEvidence({ objective: clean, targetKey: context.targetKey }), requestResearchPlan({ objective: clean, targetKey: context.targetKey })]);
  const result = await callModel(clean, undefined, undefined, [formatRndPlanningEvidence(history), formatResearchPlan(research.plan)].filter(Boolean).join("\n\n"));
  const prompt = compile(result.stylePrompt);
  return {
    prompt,
    diagnostics: {
      source: "autonomous",
      planning: { memoryEnabled: hindsightEnabled(), schemaVersion: "dmh.rnd.planning.v1", memory: history, memoryIds: history.map(item => item.id), plannerStatus: research.status, objectiveId: research.objectiveId, researchPlan: research.plan },
      model: process.env.RND_PROMPT_MODEL ?? "gemini-2.5-flash",
      masterPromptVersion: process.env.PROMPT_VERSION?.toLowerCase() ?? "v3-single",
      revisionNote: result.revisionNote,
      instruction: clean,
      stylePromptLength: result.stylePrompt.length,
      promptLength: prompt.length,
    },
  };
}

export async function optimizeAutonomousPrompt(input: {
  instruction: string;
  currentPrompt: string;
  defect: string;
  attemptNumber: number;
}) {
  const marker = "\n# REQUESTED HAIRSTYLE\n";
  const index = input.currentPrompt.lastIndexOf(marker);
  const currentStylePrompt = index >= 0 ? input.currentPrompt.slice(index + marker.length).trim() : input.currentPrompt;
  const result = await callModel(input.instruction.trim(), currentStylePrompt, input.defect.trim());
  const prompt = compile(result.stylePrompt);
  return {
    prompt,
    diagnostics: {
      source: "autonomous-optimizer",
      model: process.env.RND_PROMPT_MODEL ?? "gemini-2.5-flash",
      masterPromptVersion: process.env.PROMPT_VERSION?.toLowerCase() ?? "v3-single",
      attemptNumber: input.attemptNumber,
      revisionNote: result.revisionNote,
      defect: input.defect.trim(),
      stylePromptLength: result.stylePrompt.length,
      promptLength: prompt.length,
    },
  };
}

/** Output policy is independent of retrieved text; master bytes are prepended separately. */
export function isSafeRndStyleBlock(style: string, objective: string): boolean {
  if (unsafeResearchText(style) || /#\s*(?:master|identity|system|requested hairstyle)|\b(?:qa score|auto.?approv|publish|activate prompt)\b/i.test(style)) return false;
  for (const sentence of style.split(/[.!;\n]/)) {
    if (!/\b(?:face|facial|skin|ears?|neck|skull|background|lighting|framing|pose|body)\b/i.test(sentence)) continue;
    // Preservation language elsewhere must not excuse a positive modification.
    // Conservatively reject mixed/ambiguous non-hair clauses; the master already
    // supplies protected-region rules, so style prose need not restate them.
    for (const action of sentence.matchAll(/\b(?:alter|change|modify|smooth|regenerate|reshape|replace|widen|narrow|lighten|darken)\b/gi)) {
      const prefix = sentence.slice(0, action.index).trimEnd();
      if (!/\b(?:do not|don't|never)(?:\s+ever)?$/i.test(prefix)) return false;
    }
  }
  if (!/\b(?:dye|recolou?r|bleach|colou?r change)\b/i.test(objective)) {
    const colors = style.match(/\b(?:blonde|platinum|auburn|brunette|ginger|black|brown|red|pink|blue|green|grey|gray|silver|white)\b/gi) ?? [];
    if (colors.some(color => !new RegExp("\\b" + color + "\\b", "i").test(objective))) return false;
  }
  return true;
}
