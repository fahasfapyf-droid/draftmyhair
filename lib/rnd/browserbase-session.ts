const PROJECT_ID = process.env.BROWSERBASE_PROJECT_ID?.trim();
const CONTEXT_ID = process.env.RND_BROWSERBASE_CONTEXT_ID?.trim();
const API_BASE = "https://api.browserbase.com";
const FUNCTION_ID = "16a6e236-6f02-4796-9f32-9e3c909cf7ac";

function config() {
  const apiKey = process.env.BROWSERBASE_API_KEY?.trim();
  if (!apiKey) throw new Error("BROWSERBASE_API_KEY is not configured.");
  if (!PROJECT_ID) throw new Error("BROWSERBASE_PROJECT_ID is not configured.");
  if (!CONTEXT_ID) throw new Error("RND_BROWSERBASE_CONTEXT_ID is not configured.");
  return { apiKey, projectId: PROJECT_ID, contextId: CONTEXT_ID };
}

async function bbFetch(path: string, init: RequestInit = {}) {
  const { apiKey } = config();
  const response = await fetch(API_BASE + path, {
    ...init,
    headers: {
      "content-type": "application/json",
      "x-bb-api-key": apiKey,
      ...(init.headers || {}),
    },
    cache: "no-store",
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message = typeof body?.message === "string" ? body.message : typeof body?.error === "string" ? body.error : "Browserbase API request failed.";
    throw new Error(message);
  }
  return body;
}

export async function createSupervisedGeminiSession() {
  const { projectId, contextId } = config();
  const session = await bbFetch("/v1/sessions", {
    method: "POST",
    body: JSON.stringify({
      projectId,
      keepAlive: true,
      timeout: 15 * 60,
      browserSettings: {
        context: { id: contextId, persist: true },
        solveCaptchas: false,
        recordSession: true,
        logSession: true,
      },
      userMetadata: { source: "draftmyhair-rnd-supervised-login" },
    }),
  });

  const live = await bbFetch("/v1/sessions/" + encodeURIComponent(session.id) + "/debug", {
    method: "GET",
  });

  return {
    sessionId: session.id,
    contextId,
    expiresAt: session.expiresAt,
    liveViewUrl: live.debuggerFullscreenUrl,
    status: session.status,
  };
}

export async function getSupervisedGeminiSession(sessionId: string) {
  const { projectId, contextId } = config();
  const session = await bbFetch("/v1/sessions/" + encodeURIComponent(sessionId), { method: "GET" });
  if (session.projectId !== projectId || session.contextId !== contextId) {
    throw new Error("Session does not belong to the configured R&D Browserbase project/context.");
  }
  return session;
}

export async function releaseSupervisedGeminiSession(sessionId: string) {
  const { projectId } = config();
  await getSupervisedGeminiSession(sessionId);
  return bbFetch("/v1/sessions/" + encodeURIComponent(sessionId), {
    method: "POST",
    body: JSON.stringify({ projectId, status: "REQUEST_RELEASE" }),
  });
}

export async function invokeGeminiCalibration() {
  const result = await bbFetch("/v1/functions/" + FUNCTION_ID + "/invoke", {
    method: "POST",
    body: JSON.stringify({ params: { mode: "calibrate" } }),
  });
  return result;
}

export async function getGeminiCalibrationInvocation(invocationId: string) {
  return bbFetch("/v1/functions/invocations/" + encodeURIComponent(invocationId), {
    method: "GET",
  });
}
