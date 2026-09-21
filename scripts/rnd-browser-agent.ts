/*
 * Draft My Hair R&D browser agent.
 *
 * This file is intentionally an external-agent entry point. It is NOT imported
 * by Next.js/Vercel. Run it in a browser-capable agent environment with
 * Playwright installed and a persistent Chromium profile already authenticated
 * to the authorized Gemini account.
 *
 * Required environment:
 *   RND_APP_URL
 *   RND_WORKER_TOKEN
 *   RND_WORKER_ID
 *   RND_BLOB_READ_WRITE_TOKEN
 *   GEMINI_PROFILE_DIR
 *
 * The agent never creates R&D jobs. It only claims existing jobs, performs the
 * normal Gemini UI workflow, uploads the resulting image, and reports it.
 *
 * Do not add CAPTCHA bypasses, anti-bot evasion, rate-limit bypasses, or
 * account-creation logic.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { chromium, type BrowserContext, type Page } from "playwright";

const appUrl = required("RND_APP_URL").replace(/\/$/, "");
const workerToken = required("RND_WORKER_TOKEN");
const workerId = required("RND_WORKER_ID");
const blobToken = required("RND_BLOB_READ_WRITE_TOKEN");
const profileDir = required("GEMINI_PROFILE_DIR");

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(name + " is required");
  return value;
}

async function api(pathname: string, init?: RequestInit) {
  const response = await fetch(appUrl + pathname, {
    ...init,
    headers: {
      ...(init?.headers || {}),
      authorization: "Bearer " + workerToken,
      "x-rnd-worker-id": workerId,
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error((data as { error?: string }).error || "R&D agent API request failed");
  return data;
}

async function downloadPrivateSource(url: string, mimeType: string) {
  const response = await fetch(url, { headers: { Authorization: "Bearer " + blobToken }, cache: "no-store" });
  if (!response.ok) throw new Error("Could not download the private R&D source asset.");
  const buffer = Buffer.from(await response.arrayBuffer());
  const extension = mimeType === "image/jpeg" ? "jpg" : mimeType === "image/webp" ? "webp" : "png";
  const file = path.join(profileDir, "rnd-source-" + Date.now() + "." + extension);
  await fs.writeFile(file, buffer);
  return file;
}

async function uploadArtifact(jobId: string, attemptNumber: number, filePath: string) {
  const bytes = await fs.readFile(filePath);
  const form = new FormData();
  form.append("jobId", jobId);
  form.append("attemptNumber", String(attemptNumber));
  form.append("image", new Blob([bytes], { type: mimeTypeFor(filePath) }), path.basename(filePath));
  return api("/api/rnd/agent/artifact", { method: "POST", body: form });
}

function mimeTypeFor(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  return "image/png";
}

async function waitForImageResult(page: Page) {
  // Gemini's UI changes over time. This intentionally uses observable image
  // elements rather than private/internal endpoints.
  const before = await page.locator("img").count();
  await page.waitForFunction((n) => document.querySelectorAll("img").length > n, before, { timeout: 180_000 });
  const images = page.locator("img");
  for (let i = await images.count() - 1; i >= 0; i--) {
    const img = images.nth(i);
    const src = await img.getAttribute("src");
    if (src?.startsWith("blob:") || src?.startsWith("data:image/")) return img;
  }
  throw new Error("Gemini result image was not detected in the normal page UI.");
}

async function runJob(context: BrowserContext, job: {
  id: string;
  attemptNumber: number;
  prompt: string;
  source: { blobUrl: string; mimeType: string };
}) {
  const sourcePath = await downloadPrivateSource(job.source.blobUrl, job.source.mimeType);
  const page = await context.newPage();
  const started = new Date().toISOString();

  try {
    await page.goto("https://gemini.google.com/", { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});

    // These selectors are deliberately visible-UI based. They should be
    // calibrated against the current Gemini UI before enabling unattended mode.
    const promptBox = page.locator("textarea").first();
    await promptBox.waitFor({ state: "visible", timeout: 30_000 });

    // TODO: replace this adapter's upload/send selectors after one supervised
    // browser run against the current Gemini UI. No private Gemini API calls.
    throw new Error("Gemini UI adapter is not yet calibrated; supervised calibration is required before unattended generation.");
  } finally {
    await page.close().catch(() => {});
    await fs.unlink(sourcePath).catch(() => {});
  }
}

async function main() {
  const context = await chromium.launchPersistentContext(profileDir, {
    headless: false,
    viewport: { width: 1440, height: 1000 },
  });

  try {
    for (;;) {
      const claimed = await api("/api/rnd/agent/claim", { method: "POST" });
      if (!(claimed as { job?: unknown }).job) {
        await new Promise((resolve) => setTimeout(resolve, 10_000));
        continue;
      }

      const job = (claimed as { job: {
        id: string;
        attemptNumber: number;
        prompt: string;
        source: { blobUrl: string; mimeType: string };
      } }).job;

      try {
        await runJob(context, job);
      } catch (error) {
        await api("/api/rnd/worker/report", {
          method: "POST",
          body: JSON.stringify({
            jobId: job.id,
            attemptNumber: job.attemptNumber,
            generationStartedAt: new Date().toISOString(),
            errorCode: "BROWSER_AGENT_ERROR",
            errorMessage: error instanceof Error ? error.message : "Browser agent failed.",
          }),
          headers: { "content-type": "application/json" },
        }).catch(() => {});
      }
    }
  } finally {
    await context.close();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
