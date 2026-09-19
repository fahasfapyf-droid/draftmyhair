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

async function callModel(instruction: string, currentStylePrompt?: string, defect?: string): Promise<ModelResult> {
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
      parts: [{ text: SYSTEM + "\n\n" + task }],
    }],
    config: {
      responseMimeType: "application/json",
      responseSchema: OUTPUT_SCHEMA,
      maxOutputTokens: 4096,
    },
  });

  const raw = response.text ?? response.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? "").join("") ?? "";
  if (!raw) throw new Error("Prompt model returned an empty response.");
  const result = JSON.parse(raw) as ModelResult;
  if (typeof result.stylePrompt !== "string" || result.stylePrompt.trim().length < 80) {
    throw new Error("Prompt model returned an invalid style-specific prompt.");
  }
  return { stylePrompt: result.stylePrompt.trim(), revisionNote: result.revisionNote?.trim() ?? "" };
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
  if (!prompt.includes("INPAINT HAIR ONLY")) throw new Error("Master prompt compilation failed.");
  return prompt;
}

export async function generateAutonomousPrompt(instruction: string) {
  const clean = instruction.trim();
  if (!clean) throw new Error("Human hairstyle instruction is required.");
  const result = await callModel(clean);
  const prompt = compile(result.stylePrompt);
  return {
    prompt,
    diagnostics: {
      source: "autonomous",
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
