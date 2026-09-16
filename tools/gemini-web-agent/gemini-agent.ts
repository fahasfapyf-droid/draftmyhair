import { chromium, type BrowserContext, type Page } from "playwright";
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

async function firstVisible<T>(locators: Array<() => T>, visible: (value: T) => Promise<boolean>): Promise<T> {
  for (const make of locators) {
    try {
      const value = make();
      if (await visible(value)) return value;
    } catch {
      // Try the next selector.
    }
  }
  throw new Error("Could not find a required Gemini UI element.");
}

async function waitForImageResponse(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const images = Array.from(document.images);
    return images.some((img) => {
      const src = img.currentSrc || img.src;
      return Boolean(src) && img.naturalWidth >= 512 && img.naturalHeight >= 512;
    });
  }, { timeout: 180_000 });
}

async function downloadGeneratedImage(page: Page, outputPath: string): Promise<void> {
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

  // Gemini may expose the generated asset as an image source instead of a download event.
  const source = await page.evaluate(() => {
    const images = Array.from(document.images);
    const candidates = images
      .map((img) => ({ src: img.currentSrc || img.src, area: img.naturalWidth * img.naturalHeight }))
      .filter((item) => item.src && item.area >= 512 * 512)
      .sort((a, b) => b.area - a.area);
    return candidates[0]?.src ?? null;
  });

  if (!source) throw new Error("Gemini returned no downloadable image asset.");

  if (source.startsWith("data:")) {
    const base64 = source.split(",", 2)[1];
    if (!base64) throw new Error("Invalid data URL returned by Gemini.");
    await fs.writeFile(outputPath, Buffer.from(base64, "base64"));
    return;
  }

  const response = await page.request.get(source);
  if (!response.ok()) throw new Error(`Image download failed: HTTP ${response.status()}`);
  await fs.writeFile(outputPath, await response.body());
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

    const signIn = page.getByRole("link", { name: /sign in/i }).or(page.getByRole("button", { name: /sign in/i }));
    if (await signIn.count() && await signIn.first().isVisible().catch(() => false)) {
      console.log("Gemini requires sign-in. Complete sign-in in the opened Chrome window, then rerun this command.");
      return;
    }

    // Current Gemini web UI uses a hidden file input behind Add files.
    const fileInput = page.locator('input[type="file"]');
    await firstVisible([() => fileInput], async (locator) => (await locator.count()) > 0);
    await fileInput.first().setInputFiles(imagePath);

    const composer = page.locator('textarea').first().or(page.locator('[contenteditable="true"]').first());
    await composer.waitFor({ state: "visible", timeout: 30_000 });
    await composer.fill(prompt);

    const submit = await firstVisible([
      () => page.getByRole("button", { name: /send|submit/i }).last(),
      () => page.locator('button[type="submit"]').last(),
    ], async (locator) => (await locator.count()) > 0 && await locator.isVisible().catch(() => false));

    await submit.click();
    console.log("Prompt submitted. Waiting for Gemini image response...");

    await waitForImageResponse(page);
    await page.waitForTimeout(3_000);

    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const outputPath = path.join(OUTPUT_DIR, `gemini-${stamp}.png`);
    await downloadGeneratedImage(page, outputPath);

    console.log(`Generated image saved to: ${outputPath}`);
  } finally {
    await context.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
