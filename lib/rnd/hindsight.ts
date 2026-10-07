import { NextResponse } from "next/server";

const DEFAULT_BANK_ID = "draftmyhair-rnd";
const REQUEST_TIMEOUT_MS = 2_500;

type HindsightResult = {
  text?: unknown;
  type?: unknown;
  context?: unknown;
  metadata?: unknown;
  tags?: unknown;
  id?: unknown;
};

type HindsightRecallResponse = {
  results?: HindsightResult[];
};

function config() {
  const baseUrl = process.env.HINDSIGHT_API_URL?.trim().replace(/\/$/, "");
  const apiKey = process.env.HINDSIGHT_API_KEY?.trim() || "";
  const bankId = process.env.HINDSIGHT_RND_BANK?.trim() || DEFAULT_BANK_ID;
  if (!baseUrl) return null;
  return { baseUrl, apiKey, bankId };
}

function headers(apiKey: string) {
  return {
    "content-type": "application/json",
    ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
  };
}

async function requestJson<T>(url: string, init: RequestInit): Promise<T | null> {
  try {
    const response = await fetch(url, {
      ...init,
      headers: {
        ...headers(config()?.apiKey ?? ""),
        ...(init.headers ?? {}),
      },
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) {
      console.warn("Hindsight request failed:", response.status);
      return null;
    }
    return (await response.json()) as T;
  } catch (error) {
    console.warn("Hindsight request unavailable:", error);
    return null;
  }
}

export function hindsightEnabled() {
  return Boolean(config());
}

export async function recallRndHistory(query: string) {
  const current = config();
  if (!current || !query.trim()) return [];

  const encodedBank = encodeURIComponent(current.bankId);
  const response = await requestJson<HindsightRecallResponse>(
    `${current.baseUrl}/v1/default/banks/${encodedBank}/memories/recall`,
    {
      method: "POST",
      body: JSON.stringify({
        query: query.trim(),
        max_tokens: 1200,
        budget: "low",
        types: ["experience", "observation"],
      }),
    },
  );

  return (response?.results ?? [])
    .filter((item) => typeof item.text === "string" && item.text.trim())
    .slice(0, 6)
    .map((item) => ({
      id: typeof item.id === "string" ? item.id : null,
      text: String(item.text).trim(),
      type: typeof item.type === "string" ? item.type : null,
      context: typeof item.context === "string" ? item.context : null,
    }));
}

export async function retainRndOutcome(input: {
  jobId: string;
  attemptId: string;
  attemptNumber: number;
  targetKey: string;
  hairstyleId: string | null;
  prompt: string;
  verdict: string;
  overallScore: number | null;
  identityScore: number | null;
  styleAccuracy: number | null;
  rootIntegration: number | null;
  lightingConsistency: number | null;
  hairOnly: string | null;
  artifacts: string | null;
  refinement: string | null;
  refinementApplied: boolean;
  failureCode?: string | null;
  failureMessage?: string | null;
}) {
  const current = config();
  if (!current) return false;

  const encodedBank = encodeURIComponent(current.bankId);
  const content = [
    `DMH R&D outcome for target ${input.targetKey}.`,
    `Hairstyle: ${input.hairstyleId ?? "unknown"}.`,
    `Attempt: ${input.attemptNumber}; verdict: ${input.verdict}.`,
    `Scores: overall=${input.overallScore ?? "n/a"}, identity=${input.identityScore ?? "n/a"}, style=${input.styleAccuracy ?? "n/a"}, rootIntegration=${input.rootIntegration ?? "n/a"}, lighting=${input.lightingConsistency ?? "n/a"}.`,
    `Hair-only=${input.hairOnly ?? "n/a"}; artifacts=${input.artifacts ?? "n/a"}.`,
    `Refinement applied=${input.refinementApplied}; refinement=${input.refinement ?? "none"}.`,
    input.failureCode ? `Failure code: ${input.failureCode}.` : "",
    input.failureMessage ? `Failure message: ${input.failureMessage}.` : "",
    "This is historical R&D evidence. It must not be treated as an authoritative production prompt.",
  ].filter(Boolean).join("\n");

  const result = await requestJson<{ items_count?: number }>(
    `${current.baseUrl}/v1/default/banks/${encodedBank}/memories`,
    {
      method: "POST",
      body: JSON.stringify({
        async: true,
        items: [
          {
            content,
            document_id: `rnd/${input.jobId}/attempt/${input.attemptNumber}`,
            context: "Draft My Hair R&D experiment outcome",
            metadata: {
              jobId: input.jobId,
              attemptId: input.attemptId,
              attemptNumber: String(input.attemptNumber),
              targetKey: input.targetKey,
              hairstyleId: input.hairstyleId ?? "",
              verdict: input.verdict,
            },
            tags: ["dmh-rnd", `hairstyle:${input.hairstyleId ?? "unknown"}`, `target:${input.targetKey}`],
          },
        ],
      }),
    },
  );

  return Boolean(result);
}
