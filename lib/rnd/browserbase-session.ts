import Browserbase from "@browserbasehq/sdk";
import { chromium } from "playwright-core";

const PROJECT_ID = process.env.BROWSERBASE_PROJECT_ID?.trim();
const CONTEXT_ID = process.env.RND_BROWSERBASE_CONTEXT_ID?.trim();

function browserbase() {
  const apiKey = process.env.BROWSERBASE_API_KEY?.trim();
  if (!apiKey) throw new Error("BROWSERBASE_API_KEY is not configured.");
  if (!PROJECT_ID) throw new Error("BROWSERBASE_PROJECT_ID is not configured.");
  if (!CONTEXT_ID) throw new Error("RND_BROWSERBASE_CONTEXT_ID is not configured.");
  return new Browserbase({ apiKey });
}

export async function createSupervisedGeminiSession() {
  const client = browserbase();
  const session = await client.sessions.create({
    projectId: PROJECT_ID,
    keepAlive: true,
    api_timeout: 15 * 60,
    browserSettings: {
      context: { id: CONTEXT_ID, persist: true },
      solveCaptchas: false,
      recordSession: true,
      logSession: true,
    },
    userMetadata: {
      source: "draftmyhair-rnd-supervised-login",
    },
  });

  const browser = await chromium.connectOverCDP(session.connectUrl);
  try {
    const browserContext = browser.contexts()[0];
    const page = browserContext.pages()[0] || await browserContext.newPage();
    await page.goto("https://gemini.google.com/", {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
  } finally {
    await browser.close().catch(() => {});
  }

  const live = await client.sessions.debug(session.id);
  return {
    sessionId: session.id,
    contextId: CONTEXT_ID,
    expiresAt: session.expiresAt,
    liveViewUrl: live.debuggerFullscreenUrl,
    status: session.status,
  };
}

export async function inspectSupervisedGeminiSession(sessionId: string) {
  const client = browserbase();
  const session = await client.sessions.retrieve(sessionId);
  if (session.projectId !== PROJECT_ID || session.contextId !== CONTEXT_ID) {
    throw new Error("Session does not belong to the configured R&D Browserbase project/context.");
  }

  const browser = await chromium.connectOverCDP(session.connectUrl || "");
  try {
    const browserContext = browser.contexts()[0];
    const page = browserContext.pages()[0] || await browserContext.newPage();
    const ui = await page.evaluate(() => ({
      url: location.href,
      title: document.title,
      bodyText: document.body?.innerText?.slice(0, 3000) || "",
      authenticatedLikely: location.hostname === "gemini.google.com" &&
        Array.from(document.querySelectorAll("textarea,[contenteditable=\"true\"]")).length > 0 &&
        !/sign in|log in/i.test(document.body?.innerText || ""),
      textboxes: Array.from(document.querySelectorAll("textarea,[contenteditable=\"true\"]")).map((el) => ({
        tag: el.tagName,
        ariaLabel: el.getAttribute("aria-label"),
        placeholder: el.getAttribute("placeholder"),
      })),
      fileInputs: Array.from(document.querySelectorAll('input[type="file"]')).map((el) => ({
        accept: el.getAttribute("accept"),
        multiple: (el as HTMLInputElement).multiple,
      })),
    }));
    return { sessionId, status: session.status, ui };
  } finally {
    await browser.close().catch(() => {});
  }
}

export async function releaseSupervisedGeminiSession(sessionId: string) {
  const client = browserbase();
  const session = await client.sessions.retrieve(sessionId);
  if (session.projectId !== PROJECT_ID || session.contextId !== CONTEXT_ID) {
    throw new Error("Session does not belong to the configured R&D Browserbase project/context.");
  }
  return client.sessions.update(sessionId, {
    projectId: PROJECT_ID,
    status: "REQUEST_RELEASE",
  });
}
