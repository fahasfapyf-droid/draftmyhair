import { chromium, type BrowserContext, type Page, type Locator } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const ROOT = path.resolve(process.cwd(), "tools/gemini-web-agent");
const PROFILE_DIR = path.join(ROOT, "chrome-profile");
const OUTPUT_DIR = path.join(ROOT, "output");
const GEMINI_URL = "https://gemini.google.com/app";
const GENERATION_LOG_PATH = path.join(PROFILE_DIR, "generation-log.json");
const FIVE_MINUTES_MS = 5 * 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;
const MAX_GENERATIONS_PER_HOUR = 12;
const QA_PROMPT = `You are the strict DMH internal image QA gate. Analyze ONLY the immediately preceding generated hairstyle image against the user's requested hairstyle prompt and the DMH identity-preservation rules. Do not be generous.

Return ONLY valid JSON with this exact shape:
{"overall":0,"identity":0,"hairOnly":"PASS|FAIL","styleAccuracy":0,"rootIntegration":0,"lightingConsistency":0,"artifacts":"NONE|FOUND","verdict":"APPROVE|REGENERATE","reason":"short factual reason","refinement":"one targeted correction only, or empty string"}

Scoring: 0-10. A result can be APPROVE only when overall >= 9.5, identity >= 9.5, styleAccuracy >= 9.5, rootIntegration >= 9.5, lightingConsistency >= 9.5, hairOnly is PASS, and artifacts is NONE. Identity means the face and facial identity remain unchanged. Hair-only means no unintended changes outside hair/minimum anatomically necessary reveal. If any hard gate fails, verdict must be REGENERATE. For REGENERATE, refinement must address only the most important observed failure and must not rewrite already-passing requirements.`;

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function requiredArg(name: string): string {
  const value = arg(name);
  if (!value) throw new Error(`Missing --${name}`);
  return value;
}

async function pause(ms: number, reason: string): Promise<void> {
  console.log(`${reason} (${(ms / 1000).toFixed(1)}s)...`);
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function readGenerationLog(): Promise<number[]> {
  try {
    const raw = await fs.readFile(GENERATION_LOG_PATH, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  } catch {
    return [];
  }
}

async function writeGenerationLog(values: number[]): Promise<void> {
  await fs.writeFile(GENERATION_LOG_PATH, JSON.stringify(values, null, 2), "utf8");
}

async function waitForGenerationSlot(): Promise<void> {
  while (true) {
    const now = Date.now();
    const recent = (await readGenerationLog()).filter((stamp) => now - stamp < ONE_HOUR_MS);
    await writeGenerationLog(recent);

    if (recent.length >= MAX_GENERATIONS_PER_HOUR) {
      const waitMs = Math.max(1_000, ONE_HOUR_MS - (now - recent[0]) + 1_000);
      await pause(waitMs, "Hourly Gemini generation limit reached; waiting for the next rolling-hour slot");
      continue;
    }

    const last = recent.at(-1);
    if (last !== undefined) {
      const waitMs = FIVE_MINUTES_MS - (now - last);
      if (waitMs > 0) {
        await pause(waitMs, "Waiting for the five-minute Gemini generation slot");
        continue;
      }
    }
    return;
  }
}

async function recordGeneration(): Promise<void> {
  const now = Date.now();
  const recent = (await readGenerationLog()).filter((stamp) => now - stamp < ONE_HOUR_MS);
  recent.push(now);
  await writeGenerationLog(recent);
  console.log(`Gemini generation recorded. Rolling-hour count: ${recent.length}/${MAX_GENERATIONS_PER_HOUR}.`);
}

async function firstVisible(locators: Locator[]): Promise<Locator> {
  for (const locator of locators) {
    try {
      const count = await locator.count();
      for (let i = count - 1; i >= 0; i -= 1) {
        const candidate = locator.nth(i);
        if (await candidate.isVisible()) return candidate;
      }
    } catch {
      // Try the next selector.
    }
  }
  throw new Error("Could not find a required Gemini UI element.");
}

async function clickAddFiles(page: Page): Promise<void> {
  const addFiles = [
    page.getByRole("button", { name: /open upload file menu|add files|attach files|upload files/i }),
    page.locator('button[aria-label="Open upload file menu"]'),
    page.locator('button[aria-label*="Upload" i]'),
    page.locator('button[aria-label*="Attach" i]'),
    page.locator('button[aria-label*="Add file" i]'),
    page.locator('[role="button"][aria-label*="Upload" i]'),
    page.locator('[role="button"][aria-label*="Attach" i]'),
  ];
  for (const locator of addFiles) {
    try {
      const button = await firstVisible([locator]);
      await button.click();
      return;
    } catch {
      // Try another known label.
    }
  }
  const iconButton = page.locator('mat-icon[data-mat-icon-name="add_2"], mat-icon[fonticon="add"]');
  try {
    const icon = await firstVisible([iconButton]);
    const parentButton = icon.locator("xpath=ancestor::button[1]");
    await firstVisible([parentButton]).then((button) => button.click());
    return;
  } catch {
    // Fall through.
  }
  throw new Error("Could not find Gemini's Add files control.");
}

async function uploadReference(page: Page, imagePath: string): Promise<void> {
  let fileInput = page.locator('input[type="file"]');
  if (await fileInput.count() > 0) {
    await fileInput.first().setInputFiles(imagePath);
    await pause(2_500, "Reference image uploaded; waiting for Gemini to register it");
    return;
  }

  await clickAddFiles(page);
  await pause(900, "Upload menu opened; waiting for the file control");
  const localFileMenuItem = page.locator('[data-test-id="local-images-files-uploader-icon"]')
    .locator("xpath=ancestor::*[@role='menuitem' or self::button][1]");
  const uploadMenu = [
    localFileMenuItem,
    page.getByRole("menuitem", { name: /upload files|files|from computer|upload from computer/i }),
    page.getByText(/upload files|from computer|upload from computer/i).last(),
  ];
  for (const locator of uploadMenu) {
    try {
      const item = await firstVisible([locator]);
      const fileChooserPromise = page.waitForEvent("filechooser", { timeout: 10_000 }).catch(() => null);
      await item.click({ timeout: 10_000 });
      const fileChooser = await fileChooserPromise;
      if (fileChooser) {
        await fileChooser.setFiles(imagePath);
        await pause(2_500, "Reference image uploaded; waiting for Gemini to register it");
        return;
      }
      fileInput = page.locator('input[type="file"]');
      if (await fileInput.count() > 0) {
        await fileInput.first().setInputFiles(imagePath);
        await pause(2_500, "Reference image uploaded; waiting for Gemini to register it");
        return;
      }
    } catch {
      // Continue.
    }
  }
  fileInput = page.locator('input[type="file"]');
  if (await fileInput.count() > 0) {
    await fileInput.first().setInputFiles(imagePath);
    await pause(2_500, "Reference image uploaded; waiting for Gemini to register it");
    return;
  }
  throw new Error("Gemini did not expose a usable local-file upload control.");
}

async function findComposer(page: Page): Promise<Locator> {
  return firstVisible([
    page.locator('textarea'),
    page.locator('[contenteditable="true"][role="textbox"]'),
    page.locator('[contenteditable="true"]'),
    page.locator('textarea[placeholder*="Enter a prompt" i]'),
    page.locator('textarea[placeholder*="Ask Gemini" i]'),
  ]);
}

async function submitPrompt(page: Page, prompt: string): Promise<void> {
  const composer = await findComposer(page);
  await pause(1_200, "Reference ready; preparing prompt");
  await composer.fill(prompt);
  await pause(1_000, "Prompt entered; preparing submission");
  const sendButtons = [
    page.getByRole("button", { name: /send|submit/i }),
    page.locator('button[aria-label="Send message"]'),
    page.locator('button[aria-label*="Send" i]'),
    page.locator('button[type="submit"]'),
  ];
  for (const locator of sendButtons) {
    try {
      const button = await firstVisible([locator]);
      await button.click({ timeout: 10_000 });
      return;
    } catch {
      // Try keyboard fallback.
    }
  }
  await composer.press("Enter");
}

async function getLargeImageSources(page: Page): Promise<string[]> {
  return page.evaluate(() => Array.from(document.images)
    .map((img) => ({ src: img.currentSrc || img.src, area: img.naturalWidth * img.naturalHeight }))
    .filter((item) => item.src && item.area >= 512 * 512)
    .sort((a, b) => b.area - a.area)
    .map((item) => item.src));
}

async function waitForImageResponse(page: Page, sourcesBeforeSubmit: Set<string>): Promise<void> {
  await pause(3_500, "Gemini is processing the request");
  const deadline = Date.now() + 180_000;
  let lastLog = 0;
  while (Date.now() < deadline) {
    const sources = await getLargeImageSources(page);
    if (sources.some((src) => !sourcesBeforeSubmit.has(src))) {
      console.log("New generated image detected in Gemini.");
      return;
    }
    if (Date.now() - lastLog >= 10_000) {
      console.log("Still waiting for Gemini to finish processing...");
      lastLog = Date.now();
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error("Timed out waiting for a new generated image from Gemini.");
}

async function downloadGeneratedImage(page: Page, outputPath: string, sourcesBeforeSubmit: Set<string>): Promise<void> {
  const candidates = [
    page.getByRole("button", { name: /download full size/i }),
    page.getByRole("button", { name: /download/i }),
    page.locator('button[aria-label*="Download" i]'),
    page.locator('[title*="Download" i]'),
  ];
  for (const candidate of candidates) {
    try {
      const count = await candidate.count();
      for (let i = count - 1; i >= 0; i -= 1) {
        const button = candidate.nth(i);
        if (!(await button.isVisible())) continue;
        const downloadPromise = page.waitForEvent("download", { timeout: 20_000 }).catch(() => null);
        await button.click({ timeout: 10_000 });
        const download = await downloadPromise;
        if (download) {
          await download.saveAs(outputPath);
          return;
        }
      }
    } catch {
      // Try the next selector or DOM fallback.
    }
  }
  const source = (await getLargeImageSources(page)).find((src) => !sourcesBeforeSubmit.has(src));
  if (!source) throw new Error("Gemini returned no new downloadable image asset.");
  if (source.startsWith("data:")) {
    const base64 = source.split(",", 2)[1];
    if (!base64) throw new Error("Invalid data URL returned by Gemini.");
    await fs.writeFile(outputPath, Buffer.from(base64, "base64"));
    return;
  }
  if (source.startsWith("blob:")) {
    const base64 = await page.evaluate(async (blobUrl) => {
      const response = await fetch(blobUrl);
      if (!response.ok) throw new Error(`Blob fetch failed: HTTP ${response.status}`);
      const blob = await response.blob();
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result;
          if (typeof result !== "string") return reject(new Error("Blob conversion did not produce a data URL."));
          const comma = result.indexOf(",");
          if (comma < 0) return reject(new Error("Invalid blob data URL."));
          resolve(result.slice(comma + 1));
        };
        reader.onerror = () => reject(reader.error ?? new Error("Failed to read blob."));
        reader.readAsDataURL(blob);
      });
    }, source);
    await fs.writeFile(outputPath, Buffer.from(base64, "base64"));
    return;
  }
  const response = await page.request.get(source);
  if (!response.ok()) throw new Error(`Image download failed: HTTP ${response.status()}`);
  await fs.writeFile(outputPath, await response.body());
}

async function waitForManualSignIn(page: Page): Promise<void> {
  const signIn = page.getByRole("link", { name: /sign in/i }).or(page.getByRole("button", { name: /sign in/i }));
  if (!(await signIn.count()) || !(await signIn.first().isVisible().catch(() => false))) return;
  console.log("Gemini requires sign-in. Complete Google sign-in in the opened Chrome window.");
  console.log("Waiting up to 10 minutes for sign-in to complete...");
  await page.waitForFunction(() => {
    const text = document.body?.innerText?.toLowerCase() ?? "";
    const hasSignIn = /sign in|sign-in|log in|login/.test(text);
    const hasComposer = Boolean(document.querySelector("textarea, [contenteditable=\"true\"]"));
    return !hasSignIn && hasComposer;
  }, { timeout: 600_000, polling: 1_000 });
  await page.waitForTimeout(2_000);
  console.log("Gemini sign-in detected. Continuing...");
}

async function submitQaAndReadResult(page: Page, bodyBeforeQa: string): Promise<{
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
}> {
  await submitPrompt(page, QA_PROMPT);
  const deadline = Date.now() + 120_000;
  let previousBody = bodyBeforeQa;
  while (Date.now() < deadline) {
    await page.waitForTimeout(1_500);
    const body = await page.locator("body").innerText().catch(() => "");
    if (body.length <= previousBody.length + 20) continue;
    const tail = body.slice(Math.max(0, bodyBeforeQa.length - 200), body.length);
    const jsonMatches = [...tail.matchAll(/\{[\s\S]*?\}/g)].map((match) => match[0]);
    for (const candidate of jsonMatches.reverse()) {
      try {
        const parsed = JSON.parse(candidate);
        if (typeof parsed.verdict === "string" && typeof parsed.overall === "number") {
          return parsed;
        }
      } catch {
        // Response may still be streaming; continue polling.
      }
    }
    previousBody = body;
  }
  throw new Error("Timed out waiting for Gemini's automated QA response.");
}

async function saveQaRecord(outputPath: string, prompt: string, qa: unknown): Promise<void> {
  const qaPath = outputPath.replace(/\.png$/i, ".qa.json");
  await fs.writeFile(qaPath, JSON.stringify({ generatedImage: outputPath, prompt, qa, checkedAt: new Date().toISOString() }, null, 2), "utf8");
}

async function waitForHumanApproval(imagePath: string, prompt: string, qa: { overall: number; reason: string }): Promise<"approve" | "exit"> {
  console.log("");
  console.log("=== HUMAN APPROVAL QUEUE ===");
  console.log(`Generated image: ${imagePath}`);
  console.log(`Automated QA: ${qa.overall}/10`);
  console.log(`QA reason: ${qa.reason}`);
  console.log("Commands: APPROVE | EXIT");
  const rl = createInterface({ input, output });
  try {
    const answer = (await rl.question("Final approval: ")).trim();
    return /^approve$/i.test(answer) ? "approve" : "exit";
  } finally {
    rl.close();
  }
}

async function keepBrowserOpen(): Promise<void> {
  console.log("Chrome will remain open. Stop the agent with Ctrl+C when finished.");
  await new Promise<void>(() => {
    // Intentionally keep the process and browser alive for inspection.
  });
}

async function main(): Promise<void> {
  const imagePath = path.resolve(requiredArg("image"));
  let prompt = requiredArg("prompt");
  await fs.access(imagePath);
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  await fs.mkdir(PROFILE_DIR, { recursive: true });

  const browserPath = process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  const context: BrowserContext = await chromium.launchPersistentContext(PROFILE_DIR, {
    executablePath: browserPath,
    headless: false,
    acceptDownloads: true,
    viewport: { width: 1440, height: 1000 },
  });
  const page = context.pages()[0] ?? await context.newPage();

  try {
    await page.goto(GEMINI_URL, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForTimeout(2_000);
    await waitForManualSignIn(page);

    while (true) {
      await waitForGenerationSlot();
      await uploadReference(page, imagePath);
      const sourcesBeforeSubmit = new Set(await getLargeImageSources(page));
      await submitPrompt(page, prompt);
      await recordGeneration();
      console.log("Prompt submitted. Waiting for Gemini image response...");
      await waitForImageResponse(page, sourcesBeforeSubmit);
      await pause(2_000, "Generated image detected; allowing the result UI to settle");

      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      const outputPath = path.join(OUTPUT_DIR, `gemini-${stamp}.png`);
      await downloadGeneratedImage(page, outputPath, sourcesBeforeSubmit);
      console.log(`Generated image captured automatically: ${outputPath}`);

      const bodyBeforeQa = await page.locator("body").innerText();
      console.log("Starting automated DMH QA...");
      const qa = await submitQaAndReadResult(page, bodyBeforeQa);
      await saveQaRecord(outputPath, prompt, qa);
      console.log(`Automated QA result: ${qa.verdict}; overall ${qa.overall}/10.`);

      const hardGate = qa.overall >= 9.5 && qa.identity >= 9.5 && qa.styleAccuracy >= 9.5 &&
        qa.rootIntegration >= 9.5 && qa.lightingConsistency >= 9.5 && qa.hairOnly === "PASS" && qa.artifacts === "NONE";

      if (qa.verdict === "APPROVE" && hardGate) {
        const finalDecision = await waitForHumanApproval(outputPath, prompt, qa);
        if (finalDecision === "approve") {
          console.log("APPROVED. This prompt/media pair is ready for the internal Prompt Library.");
        } else {
          console.log("Approval queue item left unapproved. Chrome remains open.");
        }
        await keepBrowserOpen();
        return;
      }

      const refinement = typeof qa.refinement === "string" ? qa.refinement.trim() : "";
      if (!refinement) throw new Error("Automated QA requested regeneration but supplied no targeted refinement.");
      prompt = `${prompt}\n\nTARGETED QA REFINEMENT — apply only this correction and preserve all other passing requirements:\n${refinement}`;
      console.log(`QA failed. Targeted refinement queued: ${refinement}`);
      console.log("Regeneration will wait for the next five-minute Gemini slot and will count toward the hourly limit.");
    }
  } catch (error) {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const diagnosticPath = path.join(OUTPUT_DIR, `gemini-failure-${stamp}.png`);
    try {
      await page.screenshot({ path: diagnosticPath, fullPage: true });
      console.error(`Diagnostic screenshot saved to: ${diagnosticPath}`);
    } catch {
      // Preserve the original error if diagnostics cannot be captured.
    }
    console.error(error instanceof Error ? error.message : error);
    console.error("Chrome has been left open so the Gemini state can be inspected.");
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
