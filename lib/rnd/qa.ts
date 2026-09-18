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

const QA_PROMPT = [
  "You are the strict internal Draft My Hair R&D image QA gate.",
  "Evaluate the supplied generated hairstyle image against the requested hairstyle prompt.",
  "Identity preservation is a hard gate: face, skin texture/tone, expression, jawline, ears, neck, head geometry, framing, lighting, background and photographic texture must remain unchanged.",
  "Hair-only transformation is a hard gate.",
  "Return ONLY valid JSON with exactly these keys:",
  '{"overall":0,"identity":0,"hairOnly":"PASS|FAIL","styleAccuracy":0,"rootIntegration":0,"lightingConsistency":0,"artifacts":"NONE|FOUND","verdict":"APPROVE|REGENERATE","reason":"short factual reason","refinement":"one targeted correction only, or empty string"}',
  "Scores are 0-10.",
  "APPROVE requires overall >= 9.5, identity >= 9.5, styleAccuracy >= 9.5, rootIntegration >= 9.5, lightingConsistency >= 9.5, hairOnly PASS, and artifacts NONE.",
  "If any hard gate fails, verdict must be REGENERATE.",
  "If regenerating, refinement must describe only the single most important observed defect and must preserve all passing requirements.",
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
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("QA model returned no JSON.");
  const value = JSON.parse(match[0]) as RndQaResult;
  for (const key of ["overall","identity","styleAccuracy","rootIntegration","lightingConsistency"] as const) {
    if (typeof value[key] !== "number" || value[key] < 0 || value[key] > 10) throw new Error("QA returned an invalid score.");
  }
  if (!["PASS","FAIL"].includes(value.hairOnly) || !["NONE","FOUND"].includes(value.artifacts) ||
      !["APPROVE","REGENERATE"].includes(value.verdict) ||
      typeof value.reason !== "string" || typeof value.refinement !== "string") {
    throw new Error("QA returned an invalid verdict.");
  }
  return value;
}

export async function runRndQa(imageBuffer: Buffer, mimeType: string, prompt: string) {
  const ai = getClient();
  const response = await ai.models.generateContent({
    model: process.env.RND_QA_MODEL ?? "gemini-3-pro-image",
    contents: [{
      role: "user",
      parts: [
        { inlineData: { mimeType, data: imageBuffer.toString("base64") } },
        { text: QA_PROMPT + "\n\nREQUESTED STYLE PROMPT:\n" + prompt },
      ],
    }],
    config: { responseModalities: ["TEXT"] },
  });
  const text = response.text ?? response.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? "").join("") ?? "";
  return parseQa(text);
}
