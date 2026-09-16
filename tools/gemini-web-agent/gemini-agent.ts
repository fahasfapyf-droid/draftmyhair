import { chromium, type BrowserContext, type Page, type Locator } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(process.cwd(), "tools/gemini-web-agent");
const PROFILE_DIR = path.join(ROOT, "chrome-profile");
const OUTPUT_DIR = path.join(ROOT, "output");
const GEMINI_URL = "https://gemini.google.com/app";

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
    // Fall through to the diagnostic error.
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
      // Continue with the next upload-menu selector.
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
      // Try keyboard fallback below.
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
    const newSources = sources.filter((src) => !sourcesBeforeSubmit.has(src));
    if (newSources.length > 0) {
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
      // Try another selector or the DOM fallback below.
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
          if (typeof result !== "string") {
            reject(new Error("Blob conversion did not produce a data URL."));
            return;
          }
          const comma = result.indexOf(",");
          if (comma < 0) {
            reject(new Error("Invalid blob data URL."));
            return;
          }
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

async function keepBrowserOpen(): Promise<void> {
  console.log("Generation complete. Chrome will remain open for inspection.");
  console.log("The agent will keep this Gemini window open. Press Ctrl+C only when you want to stop the agent.");
  await new Promise<void>(() => {
    // Intentionally keep the process and browser alive for manual inspection.
  });
}

async function main(): Promise<void> {
  const imagePath = path.resolve(requiredArg("image"));
  const prompt = requiredArg("prompt");

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
    await uploadReference(page, imagePath);

    // Capture the baseline only AFTER the reference image has been uploaded.
    // This prevents the uploaded reference from being mistaken for Gemini's result.
    const sourcesBeforeSubmit = new Set(await getLargeImageSources(page));

    await submitPrompt(page, prompt);
    console.log("Prompt submitted. Waiting for Gemini image response...");

    await waitForImageResponse(page, sourcesBeforeSubmit);
    await pause(2_000, "Generated image detected; allowing the result UI to settle");

    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const outputPath = path.join(OUTPUT_DIR, `gemini-${stamp}.png`);
    await downloadGeneratedImage(page, outputPath, sourcesBeforeSubmit);

    console.log(`Generated image saved to: ${outputPath}`);
    await keepBrowserOpen();
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
    return;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
