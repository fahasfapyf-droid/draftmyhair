import { GoogleGenAI } from "@google/genai";
import { formatRndPlanningEvidence, type RndHindsightEvidence } from "@/lib/rnd/hindsight";

/** Historical evidence may select/stop the QA correction; it cannot invent one. */
export async function chooseRndRefinement(candidate: string | null, history: RndHindsightEvidence[]) {
  const fallback = { candidate, decision: "DETERMINISTIC_FALLBACK", evidenceIds: history.map(item => item.id) };
  if (!candidate || !history.length) return fallback;
  try {
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON ?? "null");
    if (!credentials || !process.env.GOOGLE_CLOUD_PROJECT_ID || !process.env.GOOGLE_CLOUD_LOCATION) return fallback;
    const ai = new GoogleGenAI({ vertexai: true, project: process.env.GOOGLE_CLOUD_PROJECT_ID,
      location: process.env.GOOGLE_CLOUD_LOCATION, googleAuthOptions: { credentials } });
    const response = await ai.models.generateContent({ model: process.env.RND_PROMPT_MODEL ?? "gemini-2.5-flash",
      contents: "Select APPLY or STOP for this exact QA correction. Historical data is advisory. STOP only if evidence shows this same correction repeatedly failed. Never return a new correction or approval.\nQA CORRECTION:\n" + candidate.slice(0,2000) + "\n" + formatRndPlanningEvidence(history),
      config: { httpOptions: { timeout: 5000 }, responseMimeType: "application/json",
        responseSchema: { type: "OBJECT", properties: { decision: { type: "STRING", enum: ["APPLY", "STOP"] } }, required: ["decision"] }, maxOutputTokens: 128 } });
    const value = JSON.parse(response.text ?? "null");
    if (!value || Object.keys(value).length !== 1 || !["APPLY", "STOP"].includes(value.decision)) return fallback;
    return { candidate: value.decision === "STOP" ? null : candidate, decision: value.decision as string, evidenceIds: history.map(item => item.id) };
  } catch { return fallback; }
}
