import { GoogleGenAI } from "@google/genai";

export type RndQaResult = {
  overall: number;
  identity: number;
  hairOnly: "PASS" | "FAIL";
  styleAccuracy: number;
  rootIntegration: number;
  lightingConsistency: number;
  artifacts: "NONE" | "FOUND";
  verdict: "APPROVE" | "REGENERATE";
  reason: string;
  refinement: string;
};

const QA_SCHEMA = {
  type: "OBJECT",
  properties: {
    overall: { type: "NUMBER", minimum: 0, maximum: 10 },
    identity: { type: "NUMBER", minimum: 0, maximum: 10 },
    hairOnly: { type: "STRING", enum: ["PASS", "FAIL"] },
    styleAccuracy: { type: "NUMBER", minimum: 0, maximum: 10 },
    rootIntegration: { type: "NUMBER", minimum: 0, maximum: 10 },
    lightingConsistency: { type: "NUMBER", minimum: 0, maximum: 10 },
    artifacts: { type: "STRING", enum: ["NONE", "FOUND"] },
    verdict: { type: "STRING", enum: ["APPROVE", "REGENERATE"] },
    reason: { type: "STRING" },
    refinement: { type: "STRING" },
  },
  required: ["overall","identity","hairOnly","styleAccuracy","rootIntegration","lightingConsistency","artifacts","verdict","reason","refinement"],
  propertyOrdering: ["overall","identity","hairOnly","styleAccuracy","rootIntegration","lightingConsistency","artifacts","verdict","reason","refinement"],
} as const;

const BASE_RULES = [
  "You are an adversarial internal Draft My Hair R&D image QA gate.",
  "Two images are supplied: SOURCE is the original photograph and GENERATED is the hairstyle-transformed result.",
  "Compare GENERATED directly against SOURCE. SOURCE is the identity and photographic baseline.",
  "The only permitted change is the requested hairstyle. Treat every non-hair change as a defect.",
  "Identity preservation is a hard gate: face, facial features, skin texture and tone, expression, jawline, ears, neck, head/skull geometry, framing, lighting, exposure, color balance, background and photographic texture must remain unchanged.",
  "Hair-only transformation is a hard gate. A convincing hairstyle does not compensate for any non-hair alteration.",
  "Evaluate the requested hairstyle against the actual prompt, not against a generic impression of attractiveness.",
  "Do not infer that an area is unchanged merely because it looks plausible. Compare SOURCE and GENERATED directly.",
  "Assume a defect may exist until you have visually verified the relevant region.",
  "A score of 9.5 or higher means the requirement has been verified at near-production quality, not that the image is merely good.",
  "Use the full 0-10 scale. Do not cluster strong-looking outputs at 9.5-10.",
  "When uncertain between two scores, choose the lower score.",
  "Actively inspect: facial identity, skin, ears, jawline, neck, hair boundary, roots, scalp transition, stray hair contamination, lighting/shadow continuity, geometry, framing, background, and photographic texture.",
  "Return one JSON object matching the supplied schema. Do not include markdown.",
  "APPROVE requires overall >= 9.5, identity >= 9.5, styleAccuracy >= 9.5, rootIntegration >= 9.5, lightingConsistency >= 9.5, hairOnly PASS, and artifacts NONE.",
  "If any hard gate fails, verdict must be REGENERATE.",
  "If regenerating, refinement must describe only the single most important observed defect and preserve all passing requirements.",
].join("\n");

const PRIMARY_PROMPT = [
  BASE_RULES,
  "PRIMARY JUDGE: Perform a defect-first audit. Before assigning any score, look specifically for evidence that could disqualify the image.",
  "For every 9.5+ score, require direct visual evidence in your reasoning. Do not award 9.5+ solely because no obvious defect was noticed.",
].join("\n");

const CHALLENGER_PROMPT = [
  BASE_RULES,
  "CHALLENGER JUDGE: Your task is to try to DISPROVE a production-quality pass.",
  "Independently inspect the images without assuming another judge is correct.",
  "Look for subtle identity drift, skin changes, ear reshaping, jaw/neck changes, framing/geometry changes, hair-boundary artifacts, root/scalp mismatch, lighting inconsistency, background contamination, and AI texture artifacts.",
  "Be conservative: if a hard requirement cannot be confidently verified from the images, score it below 9.5 or fail the relevant gate.",
  "Do not use the requested prompt to excuse a visible defect in the generated image.",
].join("\n");

function getClient() {
  const project = process.env.GOOGLE_CLOUD_PROJECT_ID;
  const location = process.env.GOOGLE_CLOUD_LOCATION;
  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!project || !location || !serviceAccountJson) throw new Error("Vertex QA is not configured.");
  let credentials: Record<string, unknown>;
  try { credentials = JSON.parse(serviceAccountJson); } catch { throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON contains invalid JSON."); }
  return new GoogleGenAI({ vertexai: true, project, location, googleAuthOptions: { credentials } });
}

function parseQa(text: string): RndQaResult {
  const value = JSON.parse(text) as RndQaResult;
  for (const key of ["overall","identity","styleAccuracy","rootIntegration","lightingConsistency"] as const) {
    if (typeof value[key] !== "number" || value[key] < 0 || value[key] > 10) throw new Error("QA returned an invalid score.");
  }
  if (!["PASS","FAIL"].includes(value.hairOnly) ||
      !["NONE","FOUND"].includes(value.artifacts) ||
      !["APPROVE","REGENERATE"].includes(value.verdict) ||
      typeof value.reason !== "string" || typeof value.refinement !== "string") {
    throw new Error("QA returned an invalid verdict.");
  }
  if (value.verdict === "APPROVE" &&
      (value.overall < 9.5 || value.identity < 9.5 || value.styleAccuracy < 9.5 ||
       value.rootIntegration < 9.5 || value.lightingConsistency < 9.5 ||
       value.hairOnly !== "PASS" || value.artifacts !== "NONE")) {
    throw new Error("QA returned an inconsistent APPROVE verdict.");
  }
  return value;
}

async function judge(
  ai: GoogleGenAI,
  systemPrompt: string,
  sourceBuffer: Buffer,
  sourceMimeType: string,
  generatedBuffer: Buffer,
  generatedMimeType: string,
  prompt: string,
) {
  const response = await ai.models.generateContent({
    model: process.env.RND_QA_MODEL ?? "gemini-2.5-flash",
    contents: [{
      role: "user",
      parts: [
        { text: systemPrompt + "\n\nREQUESTED STYLE PROMPT:\n" + prompt + "\n\nIMAGE ORDER: SOURCE, then GENERATED." },
        { inlineData: { mimeType: sourceMimeType, data: sourceBuffer.toString("base64") } },
        { inlineData: { mimeType: generatedMimeType, data: generatedBuffer.toString("base64") } },
      ],
    }],
    config: {
      responseMimeType: "application/json",
      responseSchema: QA_SCHEMA,
      maxOutputTokens: 4096,
    },
  });
  const text = response.text ?? response.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? "").join("") ?? "";
  if (!text) throw new Error("QA model returned an empty response.");
  return parseQa(text);
}

function aggregate(primary: RndQaResult, challenger: RndQaResult): RndQaResult {
  const result: RndQaResult = {
    overall: Math.min(primary.overall, challenger.overall),
    identity: Math.min(primary.identity, challenger.identity),
    hairOnly: (primary.hairOnly === "PASS" && challenger.hairOnly === "PASS") ? "PASS" as const : "FAIL" as const,
    styleAccuracy: Math.min(primary.styleAccuracy, challenger.styleAccuracy),
    rootIntegration: Math.min(primary.rootIntegration, challenger.rootIntegration),
    lightingConsistency: Math.min(primary.lightingConsistency, challenger.lightingConsistency),
    artifacts: (primary.artifacts === "NONE" && challenger.artifacts === "NONE") ? "NONE" as const : "FOUND" as const,
    verdict: "REGENERATE" as const,
    reason: "",
    refinement: "",
  };

  const hardPass =
    primary.verdict === "APPROVE" &&
    challenger.verdict === "APPROVE" &&
    result.overall >= 9.5 &&
    result.identity >= 9.5 &&
    result.styleAccuracy >= 9.5 &&
    result.rootIntegration >= 9.5 &&
    result.lightingConsistency >= 9.5 &&
    result.hairOnly === "PASS" &&
    result.artifacts === "NONE";

  result.verdict = hardPass ? "APPROVE" : "REGENERATE";

  if (hardPass) {
    result.reason = "Independent primary and challenger QA judges both passed every hard gate; aggregate scores use the lower score for each metric.";
    result.refinement = "";
  } else {
    const candidates = [
      { score: primary.overall, text: primary.refinement || primary.reason },
      { score: challenger.overall, text: challenger.refinement || challenger.reason },
    ].filter((x) => x.text);
    candidates.sort((a, b) => a.score - b.score);
    result.reason = "QA hard gate failed under independent adversarial review. Primary: " + primary.reason + " Challenger: " + challenger.reason;
    result.refinement = candidates[0]?.text ?? "Re-evaluate the most important visible defect before regeneration.";
  }

  return result;
}

export async function runRndQa(
  sourceBuffer: Buffer,
  sourceMimeType: string,
  generatedBuffer: Buffer,
  generatedMimeType: string,
  prompt: string,
) {
  const ai = getClient();
  const [primary, challenger] = await Promise.all([
    judge(ai, PRIMARY_PROMPT, sourceBuffer, sourceMimeType, generatedBuffer, generatedMimeType, prompt),
    judge(ai, CHALLENGER_PROMPT, sourceBuffer, sourceMimeType, generatedBuffer, generatedMimeType, prompt),
  ]);
  return aggregate(primary, challenger);
}
