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

export type RndFinalVerificationResult = {
  overall: number;
  identity: number;
  hairOnly: "PASS" | "FAIL";
  styleAccuracy: number;
  rootIntegration: number;
  lightingConsistency: number;
  artifacts: "NONE" | "FOUND";
  verdict: "PASS" | "REJECT";
  reason: string;
  refinement: string;
};

const FINAL_VERIFICATION_PROMPT = [
  "You are the independent final verification gate for Draft My Hair.",
  "You are a second evaluator. Do not assume any previous QA score or verdict is correct; perform your own inspection from the supplied SOURCE, GENERATED image, and authoritative hairstyle prompt.",
  "The business promise is: Same face. Different hair.",
  "The face is locked. Any visible or material change to facial identity, skin texture/tone, expression, jawline, ears, neck, head/skull geometry, pose, framing, camera perspective, lighting, exposure, color balance, background, or photographic texture is a rejection.",
  "Only the hair may change. Hair must integrate naturally into the existing scalp and lighting.",
  "Judge hairstyle accuracy against the authoritative prompt, not against a creative reinterpretation.",
  "This is an acceptance test, not a creative critique. Be conservative: when a hard requirement is not clearly satisfied, reject.",
  "Return one JSON object matching the supplied schema. Do not include markdown.",
  "PASS requires overall >= 9.5, identity >= 9.5, styleAccuracy >= 9.5, rootIntegration >= 9.5, lightingConsistency >= 9.5, hairOnly PASS, and artifacts NONE.",
  "If any hard gate fails, verdict must be REJECT.",
  "If rejected, refinement must contain exactly one targeted correction grounded in the authoritative hairstyle requirements or an observed unwanted characteristic. Never propose changes to the face or any protected non-hair region.",
].join("\n");

const FINAL_VERIFICATION_SCHEMA = {
  type: "OBJECT",
  properties: {
    overall: { type: "NUMBER", minimum: 0, maximum: 10 },
    identity: { type: "NUMBER", minimum: 0, maximum: 10 },
    hairOnly: { type: "STRING", enum: ["PASS", "FAIL"] },
    styleAccuracy: { type: "NUMBER", minimum: 0, maximum: 10 },
    rootIntegration: { type: "NUMBER", minimum: 0, maximum: 10 },
    lightingConsistency: { type: "NUMBER", minimum: 0, maximum: 10 },
    artifacts: { type: "STRING", enum: ["NONE", "FOUND"] },
    verdict: { type: "STRING", enum: ["PASS", "REJECT"] },
    reason: { type: "STRING" },
    refinement: { type: "STRING" },
  },
  required: ["overall","identity","hairOnly","styleAccuracy","rootIntegration","lightingConsistency","artifacts","verdict","reason","refinement"],
  propertyOrdering: ["overall","identity","hairOnly","styleAccuracy","rootIntegration","lightingConsistency","artifacts","verdict","reason","refinement"],
} as const;

function parseFinalVerification(text: string): RndFinalVerificationResult {
  const value = JSON.parse(text) as RndFinalVerificationResult;
  for (const key of ["overall","identity","styleAccuracy","rootIntegration","lightingConsistency"] as const) {
    if (typeof value[key] !== "number" || value[key] < 0 || value[key] > 10) throw new Error("Final verification returned an invalid score.");
  }
  if (!["PASS","REJECT"].includes(value.verdict) ||
      !["PASS","FAIL"].includes(value.hairOnly) ||
      !["NONE","FOUND"].includes(value.artifacts) ||
      typeof value.reason !== "string" ||
      typeof value.refinement !== "string") {
    throw new Error("Final verification returned an invalid verdict.");
  }
  if (value.verdict === "PASS" &&
      (value.overall < 9.5 || value.identity < 9.5 || value.styleAccuracy < 9.5 ||
       value.rootIntegration < 9.5 || value.lightingConsistency < 9.5 ||
       value.hairOnly !== "PASS" || value.artifacts !== "NONE")) {
    throw new Error("Final verification returned an inconsistent PASS verdict.");
  }
  return value;
}

export async function runRndFinalVerification(
  sourceBuffer: Buffer,
  sourceMimeType: string,
  generatedBuffer: Buffer,
  generatedMimeType: string,
  prompt: string,
) {
  const ai = getClient();
  const response = await ai.models.generateContent({
    model: process.env.RND_FINAL_QA_MODEL ?? "gemini-2.5-pro",
    contents: [{
      role: "user",
      parts: [
        { text: FINAL_VERIFICATION_PROMPT + "\n\nAUTHORITATIVE STYLE PROMPT:\n" + prompt + "\n\nIMAGE ORDER: SOURCE, then GENERATED." },
        { inlineData: { mimeType: sourceMimeType, data: sourceBuffer.toString("base64") } },
        { inlineData: { mimeType: generatedMimeType, data: generatedBuffer.toString("base64") } },
      ],
    }],
    config: {
      responseMimeType: "application/json",
      responseSchema: FINAL_VERIFICATION_SCHEMA,
      maxOutputTokens: 4096,
    },
  });
  const text = response.text ?? response.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? "").join("") ?? "";
  if (!text) throw new Error("Final verification returned an empty response.");
  return parseFinalVerification(text);
}

const QA_PROMPT = [
  "You are the strict internal Draft My Hair R&D image QA gate.",
  "Two images are supplied: SOURCE is the original photograph and GENERATED is the hairstyle-transformed result.",
  "Compare GENERATED directly against SOURCE. SOURCE is the identity and photographic baseline; GENERATED must preserve it exactly except for the requested hair transformation.",
  "Identity preservation is a hard gate: face, facial features, skin texture/tone, expression, jawline, ears, neck, head geometry, framing, lighting, exposure, color balance, background and photographic texture must remain unchanged.",
  "Hair-only transformation is a hard gate. Do not treat a good hairstyle match as a pass if any non-hair region changed.",
  "Evaluate the generated image against the requested hairstyle prompt as well as the SOURCE image.",
  "The REQUESTED STYLE PROMPT is authoritative. Treat it as the complete hairstyle definition for this attempt.",
  "If the generated image contains a hairstyle characteristic that the authoritative prompt does not require, that characteristic is a defect and may be named only so the refinement can remove or suppress it.",
  "Never invent a new hairstyle characteristic as a proposed correction. A refinement may correct an existing authoritative requirement, improve execution of that requirement, or remove an observed unwanted characteristic.",
  "Never use refinement to change identity, facial features, skin, expression, ears, head/skull geometry, pose, framing, camera perspective, lighting, background, or any other non-hair region.",
  "Return one JSON object matching the supplied schema. Do not include markdown.",
  "APPROVE requires overall >= 9.5, identity >= 9.5, styleAccuracy >= 9.5, rootIntegration >= 9.5, lightingConsistency >= 9.5, hairOnly PASS, and artifacts NONE.",
  "If any hard gate fails, verdict must be REGENERATE.",
  "If regenerating, refinement must contain exactly one targeted correction: either improve an existing authoritative requirement or explicitly remove/suppress one observed unwanted characteristic.",
  "If no safe targeted correction can be stated without changing the authoritative hairstyle definition or a universal protected region, return an empty refinement string rather than inventing a correction.",
].join("\n");

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

export async function runRndQa(
  sourceBuffer: Buffer,
  sourceMimeType: string,
  generatedBuffer: Buffer,
  generatedMimeType: string,
  prompt: string,
) {
  const ai = getClient();
  const response = await ai.models.generateContent({
    model: process.env.RND_QA_MODEL ?? "gemini-2.5-flash",
    contents: [{
      role: "user",
      parts: [
        { text: QA_PROMPT + "\n\nREQUESTED STYLE PROMPT:\n" + prompt + "\n\nIMAGE ORDER: SOURCE, then GENERATED." },
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
