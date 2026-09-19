import { GoogleGenAI } from "@google/genai";
import { MASTER_PROMPT } from "@/lib/engine/prompts/master";
import { MASTER_PROMPT_V2 } from "@/lib/engine/prompts/master-v2";
import { MASTER_PROMPT_V3 } from "@/lib/engine/prompts/master-v3";
import { MASTER_PROMPT_V3_SINGLE } from "@/lib/engine/prompts/master-v3-single";

type PromptModelResult = { prompt: string; revisionNote: string };

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
    prompt: { type: "STRING" },
    revisionNote: { type: "STRING" },
  },
  required: ["prompt", "revisionNote"],
  propertyOrdering: ["prompt", "revisionNote"],
} as const;

const SYSTEM = [
  "You are Draft My Hair's autonomous production prompt engineer.",
  "The human supplies only a hairstyle objective. You own the prompt engineering.",
  "Produce a production-grade photorealistic hair-only transformation prompt.",
  "The master prompt is mandatory and is supplied separately; never weaken, remove, reorder, or contradict its identity-preservation, geometry-lock, skin-preservation, color-authority, or negative constraints.",
  "The style-specific section must make the requested hairstyle visually unambiguous using concrete salon geometry: length, silhouette, weight distribution, perimeter, layering, texture, direction, styling, and distinguishing characteristics.",
  "Explicitly distinguish the requested style from nearby/confusable styles when that reduces model ambiguity.",
  "Do not add generic self-check lists or hedging. Be decisive and concrete.",
  "Never instruct the image model to regenerate the face, skin, ears, neck, skull, background, pose, framing, lighting, or body.",
  "The final output must be the COMPLETE prompt, including the master constraints and the requested hairstyle section.",
  "Return JSON only.",
].join("\n");

async function callModel(instruction: string, currentPrompt?: string, defect?: string): Promise<PromptModelResult> {
  const ai = getClient();
  const master = getMasterPrompt();
  const task = currentPrompt
    ? [
        "OPTIMIZATION TASK.",
        "Human objective:", instruction,
        "Current complete prompt:", currentPrompt,
        "Automated QA defect diagnosis:", defect ?? "Improve the most important remaining transformation defect.",
        "Rewrite the COMPLETE prompt, preserving every passing requirement and changing only what is necessary to address the diagnosed defect.",
        "Do not merely append the diagnosis. Integrate the correction into the appropriate style-specific language.",
      ].join("\n\n")
    : [
        "INITIAL PROMPT TASK.",
        "Human objective:", instruction,
        "Use the master framework below as immutable constraints.",
        "Write a complete prompt whose style-specific section is derived from the human objective.",
      ].join("\n\n");

  const response = await ai.models.generateContent({
    model: process.env.RND_PROMPT_MODEL ?? "gemini-2.5-flash",
    contents: [{
      role: "user",
      parts: [{ text: SYSTEM + "\n\nMASTER PROMPT:\n" + master + "\n\n" + task }],
    }],
    config: {
      responseMimeType: "application/json",
      responseSchema: OUTPUT_SCHEMA,
      maxOutputTokens: 8192,
    },
  });

  const raw = response.text ?? response.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? "").join("") ?? "";
  if (!raw) throw new Error("Prompt model returned an empty response.");
  const result = JSON.parse(raw) as PromptModelResult;
  if (typeof result.prompt !== "string" || result.prompt.trim().length < 500) throw new Error("Prompt model returned an invalid production prompt.");
  if (!result.prompt.includes("# INPAINT HAIR ONLY") && !result.prompt.includes("INPAINT HAIR ONLY")) {
    throw new Error("Generated prompt does not contain the mandatory master constraints.");
  }
  return { prompt: result.prompt.trim(), revisionNote: result.revisionNote?.trim() ?? "" };
}

export async function generateAutonomousPrompt(instruction: string) {
  const clean = instruction.trim();
  if (!clean) throw new Error("Human hairstyle instruction is required.");
  const result = await callModel(clean);
  return {
    prompt: result.prompt,
    diagnostics: {
      source: "autonomous",
      model: process.env.RND_PROMPT_MODEL ?? "gemini-2.5-flash",
      revisionNote: result.revisionNote,
      instruction: clean,
      promptLength: result.prompt.length,
    },
  };
}

export async function optimizeAutonomousPrompt(input: {
  instruction: string;
  currentPrompt: string;
  defect: string;
  attemptNumber: number;
}) {
  const result = await callModel(input.instruction.trim(), input.currentPrompt, input.defect.trim());
  return {
    prompt: result.prompt,
    diagnostics: {
      source: "autonomous-optimizer",
      model: process.env.RND_PROMPT_MODEL ?? "gemini-2.5-flash",
      attemptNumber: input.attemptNumber,
      revisionNote: result.revisionNote,
      defect: input.defect.trim(),
      promptLength: result.prompt.length,
    },
  };
}
