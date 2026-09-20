import { GoogleGenAI } from "@google/genai";

export type RndQaCategory =
  | "HAIRSTYLE"
  | "BEARD"
  | "COLOR"
  | "BUZZ_BALD";

export type RndQaVerifierResult = {
  blockingDefect: boolean;
  reason: string;
};

export type RndQaResult = {
  overall: number;
  hairstyleAccuracy: number;
  beardAccuracy: number;
  colorAccuracy: number;
  buzzBaldAccuracy: number;
  rootIntegration: number;
  transformationOnly: "PASS" | "FAIL";
  artifacts: "NONE" | "FOUND";
  applicableCategories: RndQaCategory[];
  verdict: "APPROVE" | "REGENERATE";
  reason: string;
  refinement: string;
  verifier: RndQaVerifierResult;
};

const QA_SCHEMA = {
  type: "OBJECT",
  properties: {
    overall: { type: "NUMBER", minimum: 0, maximum: 10 },
    hairstyleAccuracy: { type: "NUMBER", minimum: 0, maximum: 10 },
    beardAccuracy: { type: "NUMBER", minimum: 0, maximum: 10 },
    colorAccuracy: { type: "NUMBER", minimum: 0, maximum: 10 },
    buzzBaldAccuracy: { type: "NUMBER", minimum: 0, maximum: 10 },
    rootIntegration: { type: "NUMBER", minimum: 0, maximum: 10 },
    transformationOnly: { type: "STRING", enum: ["PASS", "FAIL"] },
    artifacts: { type: "STRING", enum: ["NONE", "FOUND"] },
    applicableCategories: {
      type: "ARRAY",
      items: { type: "STRING", enum: ["HAIRSTYLE", "BEARD", "COLOR", "BUZZ_BALD"] },
    },
    verdict: { type: "STRING", enum: ["APPROVE", "REGENERATE"] },
    reason: { type: "STRING" },
    refinement: { type: "STRING" },
  },
  required: [
    "overall",
    "hairstyleAccuracy",
    "beardAccuracy",
    "colorAccuracy",
    "buzzBaldAccuracy",
    "rootIntegration",
    "transformationOnly",
    "artifacts",
    "applicableCategories",
    "verdict",
    "reason",
    "refinement",
  ],
  propertyOrdering: [
    "overall",
    "hairstyleAccuracy",
    "beardAccuracy",
    "colorAccuracy",
    "buzzBaldAccuracy",
    "rootIntegration",
    "transformationOnly",
    "artifacts",
    "applicableCategories",
    "verdict",
    "reason",
    "refinement",
  ],
} as const;

const BASE_RULES = [
  "You are the dedicated Hair Transformation QA gate for Draft My Hair R&D.",
  "Your scope is ONLY the requested hair/beard/color transformation.",
  "SOURCE is the original photograph. GENERATED is the transformed result.",
  "Do NOT score or judge identity, facial similarity, facial features, skin texture/tone, expression, jawline, ears, neck, head/skull geometry, pose, head tilt, rotation, framing, zoom, crop, perspective, lighting, exposure, background, camera grain, or photographic consistency. Those are explicitly OUT OF SCOPE for this QA gate.",
  "Evaluate the GENERATED image against the requested transformation in the supplied prompt and compare directly with SOURCE only where necessary to determine the requested transformation.",
  "Hairstyle accuracy: inspect the actual requested haircut/style, length, silhouette, weight distribution, layering, perimeter, texture, styling characteristics, and distinguishing features. Do not reward a generic attractive haircut when it is the wrong requested style.",
  "Beard accuracy: when beard/facial-hair addition or removal is requested, inspect only the requested beard state, shape, density, length, neckline, cheek boundary, texture, and completeness. Addition and removal are both hard requirements.",
  "Color accuracy: when hair color is requested, inspect only the requested hair color, root-to-length consistency, natural variation, color contamination, and whether non-hair regions remain free of hair-color spill. Do not judge global lighting.",
  "Buzz/Bald accuracy: when buzz cut or bald is requested, inspect clipper-length appearance, uniformity, hairline, temples, crown, density, scalp visibility, residual hair, and whether the result looks like genuine short hair or genuine baldness rather than painted-on hair.",
  "Root/scalp integration: inspect only hair-to-scalp integration, root transition, density transition, edges, and believable contact. Do not judge overall lighting.",
  "Transformation-only compliance: PASS only when the requested transformation is cleanly localized to hair/beard/color and there is no visible transformation spill outside the intended region. This is not an identity or pose score.",
  "Artifacts: inspect only transformation-related artifacts such as wig edges, painted-on hair, broken hair strands, malformed beard boundaries, scalp artifacts, color spill, duplicate hair structures, or other generation defects in the transformed region.",
  "Determine applicableCategories from the requested transformation: HAIRSTYLE for haircut/style requests; BEARD for beard addition/removal; COLOR for dye/color-change requests; BUZZ_BALD for buzz-cut or bald requests. Multiple categories may apply.",
  "For non-applicable category scores, return 10. They must not affect the verdict.",
  "Score only from directly observed transformation evidence. Do not infer a score from the existence of an approval threshold or from the expected business outcome.",
  "Use the full 0-10 scale. Do not cluster acceptable outputs at 9.5-10.",
  "Assume defects may exist until visually checked. If uncertain, choose the lower score.",
  "The overall score must reflect the weakest applicable transformation category and rootIntegration; do not average away a weak hairstyle, beard, color, buzz/bald, or integration result.",
  "Return one JSON object matching the supplied schema. No markdown.",
  "APPROVE means the observed transformation is production-ready under this rubric; the application, not the model, enforces the numeric approval threshold.",
  "If any applicable hard gate fails, verdict must be REGENERATE.",
  "If regenerating, refinement must identify ONLY the single most important transformation defect and preserve all passing requirements.",
].join("\n");

const VERIFIER_SCHEMA = {
  type: "OBJECT",
  properties: {
    blockingDefect: { type: "BOOLEAN" },
    reason: { type: "STRING" },
  },
  required: ["blockingDefect", "reason"],
  propertyOrdering: ["blockingDefect", "reason"],
} as const;

const VERIFIER_PROMPT = [
  "You are the final fail-only production verifier for Draft My Hair transformation QA.",
  "You are NOT allowed to approve, score, or promote an image.",
  "Your only authority is to VETO approval when you can identify a visible, material defect in the requested hair/beard/color transformation.",
  "SOURCE is the original photograph. GENERATED is the transformed result.",
  "Inspect only the requested transformation and its immediate integration. Do not score identity, facial similarity, skin, expression, jawline, ears, neck, head geometry, pose, framing, lighting, background, or other locked attributes.",
  "Try to disprove production readiness. Actively search for wrong haircut structure, wrong length or silhouette, incorrect weight distribution, styling mismatch, beard errors, color errors, weak root/scalp integration, transformation spill, wig-like edges, painted-on hair, malformed strands, duplicate structures, or other transformation-region artifacts.",
  "Set blockingDefect=true only when you can identify a concrete visible defect that should prevent automatic approval.",
  "If you cannot identify a concrete blocking defect after actively searching, set blockingDefect=false.",
  "Do not use or infer any numeric approval threshold. Return only the structured veto decision and concise evidence.",
  "Return one JSON object matching the supplied schema. No markdown.",
].join("\n");

const PRIMARY_PROMPT = [
  BASE_RULES,
  "PRIMARY JUDGE: Perform a defect-first audit of the requested transformation. Before scoring, actively search for subtle style mismatch, incomplete beard addition/removal, incorrect color, weak buzz/bald geometry, poor root integration, and transformation-region artifacts.",
  "For every 9.5+ applicable score, require direct visual evidence. Do not award 9.5+ simply because no obvious defect was noticed.",
].join("\n");

const CHALLENGER_PROMPT = [
  BASE_RULES,
  "CHALLENGER JUDGE: Try to DISPROVE a production-quality transformation pass.",
  "Independently inspect the requested transformation and aggressively search for subtle hairstyle mismatch, beard errors, color drift, buzz/bald realism problems, root/scalp integration defects, and transformation spill.",
  "Do not let a strong-looking face, pose, lighting, framing, or photographic match influence any transformation score; those attributes are explicitly out of scope.",
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

function parseQa(text: string): Omit<RndQaResult, "verifier"> {
  const value = JSON.parse(text) as RndQaResult;
  for (const key of [
    "overall",
    "hairstyleAccuracy",
    "beardAccuracy",
    "colorAccuracy",
    "buzzBaldAccuracy",
    "rootIntegration",
  ] as const) {
    if (typeof value[key] !== "number" || value[key] < 0 || value[key] > 10) {
      throw new Error("QA returned an invalid score.");
    }
  }

  const allowed = ["HAIRSTYLE", "BEARD", "COLOR", "BUZZ_BALD"] as const;
  if (!Array.isArray(value.applicableCategories) ||
      value.applicableCategories.some((category) => !allowed.includes(category))) {
    throw new Error("QA returned invalid applicable categories.");
  }

  if (![...new Set(value.applicableCategories)].length) {
    throw new Error("QA returned no applicable transformation category.");
  }

  if (!["PASS", "FAIL"].includes(value.transformationOnly) ||
      !["NONE", "FOUND"].includes(value.artifacts) ||
      !["APPROVE", "REGENERATE"].includes(value.verdict) ||
      typeof value.reason !== "string" ||
      typeof value.refinement !== "string") {
    throw new Error("QA returned an invalid verdict.");
  }

  const applicableScores: number[] = [];
  if (value.applicableCategories.includes("HAIRSTYLE")) applicableScores.push(value.hairstyleAccuracy);
  if (value.applicableCategories.includes("BEARD")) applicableScores.push(value.beardAccuracy);
  if (value.applicableCategories.includes("COLOR")) applicableScores.push(value.colorAccuracy);
  if (value.applicableCategories.includes("BUZZ_BALD")) applicableScores.push(value.buzzBaldAccuracy);
  applicableScores.push(value.rootIntegration);

  const expectedOverall = Math.min(...applicableScores);
  if (Math.abs(value.overall - expectedOverall) > 0.01) {
    throw new Error("QA overall must equal the weakest applicable transformation score.");
  }

  if (value.verdict === "APPROVE" &&
      (expectedOverall < 9.5 || value.transformationOnly !== "PASS" || value.artifacts !== "NONE")) {
    throw new Error("QA returned an inconsistent APPROVE verdict.");
  }

  return value;
}

async function verify(
  ai: GoogleGenAI,
  sourceBuffer: Buffer,
  sourceMimeType: string,
  generatedBuffer: Buffer,
  generatedMimeType: string,
  prompt: string,
): Promise<RndQaVerifierResult> {
  const response = await ai.models.generateContent({
    model: process.env.RND_QA_VERIFIER_MODEL ?? process.env.RND_QA_MODEL ?? "gemini-2.5-flash",
    contents: [{
      role: "user",
      parts: [
        { text: VERIFIER_PROMPT + "\n\nREQUESTED TRANSFORMATION PROMPT:\n" + prompt + "\n\nIMAGE ORDER: SOURCE, then GENERATED." },
        { inlineData: { mimeType: sourceMimeType, data: sourceBuffer.toString("base64") } },
        { inlineData: { mimeType: generatedMimeType, data: generatedBuffer.toString("base64") } },
      ],
    }],
    config: {
      responseMimeType: "application/json",
      responseSchema: VERIFIER_SCHEMA,
      maxOutputTokens: 2048,
    },
  });
  const text = response.text ?? response.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? "").join("") ?? "";
  if (!text) throw new Error("QA verifier returned an empty response.");
  const value = JSON.parse(text) as RndQaVerifierResult;
  if (typeof value.blockingDefect !== "boolean" || typeof value.reason !== "string") {
    throw new Error("QA verifier returned an invalid result.");
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
        { text: systemPrompt + "\n\nREQUESTED TRANSFORMATION PROMPT:\n" + prompt + "\n\nIMAGE ORDER: SOURCE, then GENERATED." },
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

function aggregate(primary: Omit<RndQaResult, "verifier">, challenger: Omit<RndQaResult, "verifier">, verifier: RndQaVerifierResult): RndQaResult {
  const applicableCategories = [...new Set([...primary.applicableCategories, ...challenger.applicableCategories])];

  const scoreFor = (category: RndQaCategory) => {
    const field = {
      HAIRSTYLE: "hairstyleAccuracy",
      BEARD: "beardAccuracy",
      COLOR: "colorAccuracy",
      BUZZ_BALD: "buzzBaldAccuracy",
    }[category] as keyof Omit<RndQaResult, "verifier">;
    return Math.min(primary[field] as number, challenger[field] as number);
  };

  const result: RndQaResult = {
    overall: 10,
    hairstyleAccuracy: Math.min(primary.hairstyleAccuracy, challenger.hairstyleAccuracy),
    beardAccuracy: Math.min(primary.beardAccuracy, challenger.beardAccuracy),
    colorAccuracy: Math.min(primary.colorAccuracy, challenger.colorAccuracy),
    buzzBaldAccuracy: Math.min(primary.buzzBaldAccuracy, challenger.buzzBaldAccuracy),
    rootIntegration: Math.min(primary.rootIntegration, challenger.rootIntegration),
    transformationOnly: primary.transformationOnly === "PASS" && challenger.transformationOnly === "PASS" ? "PASS" : "FAIL",
    artifacts: primary.artifacts === "NONE" && challenger.artifacts === "NONE" ? "NONE" : "FOUND",
    applicableCategories,
    verdict: "REGENERATE",
    reason: "",
    refinement: "",
    verifier,
  };

  result.overall = Math.min(
    ...applicableCategories.map(scoreFor),
    result.rootIntegration,
  );

  const hardPass =
    primary.verdict === "APPROVE" &&
    challenger.verdict === "APPROVE" &&
    result.overall >= 9.5 &&
    result.transformationOnly === "PASS" &&
    result.artifacts === "NONE" &&
    !verifier.blockingDefect;

  result.verdict = hardPass ? "APPROVE" : "REGENERATE";

  if (hardPass) {
    result.reason = "Independent primary and challenger judges passed the transformation hard gates, and the fail-only verifier found no concrete blocking transformation defect; aggregate scores use the lower judge score for each metric.";
    result.refinement = "";
  } else {
    const candidates = [
      { score: primary.overall, text: primary.refinement || primary.reason },
      { score: challenger.overall, text: challenger.refinement || challenger.reason },
    ].filter((item) => item.text);
    candidates.sort((a, b) => a.score - b.score);
    result.reason =
      "Hair-transformation QA hard gate failed under independent adversarial review. Primary: " +
      primary.reason +
      " Challenger: " +
      challenger.reason +
      " Verifier: " +
      verifier.reason;
    result.refinement = candidates[0]?.text ?? "Correct the most important visible transformation defect.";
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
  const [primary, challenger, verifier] = await Promise.all([
    judge(ai, PRIMARY_PROMPT, sourceBuffer, sourceMimeType, generatedBuffer, generatedMimeType, prompt),
    judge(ai, CHALLENGER_PROMPT, sourceBuffer, sourceMimeType, generatedBuffer, generatedMimeType, prompt),
    verify(ai, sourceBuffer, sourceMimeType, generatedBuffer, generatedMimeType, prompt),
  ]);
  return aggregate(primary, challenger, verifier);
}
