import { type Locator, type Page } from "playwright";
import { writeFile } from "node:fs/promises";

const GEMINI_URL = "https://gemini.google.com/app";

async function pause(ms: number, reason: string) {
  console.log(`${reason} (${Math.ceil(ms / 1000)}s)...`);
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function firstVisible(locators: Locator[]): Promise<Locator> {
  for (const locator of locators) {
    try {
      for (let i = await locator.count() - 1; i >= 0; i -= 1) {
        const candidate = locator.nth(i);
        if (await candidate.isVisible()) return candidate;
      }
    } catch {}
  }
  throw new Error("Required Gemini control not found.");
}

export async function openGemini(page: Page) {
  await page.goto(GEMINI_URL, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(1_800);
}

export async function assertReady(page: Page) {
  const signIn = page.getByRole("link", { name: /sign in/i }).or(
    page.getByRole("button", { name: /sign in/i }),
  );
  if (await signIn.count() && await signIn.first().isVisible().catch(() => false)) {
    throw new Error(
      "Gemini authentication is not available in the configured persistent Chrome profile. " +
      "Use the existing normal Chrome Gemini profile; do not sign in through Playwright.",
    );
  }
  await firstVisible([
    page.locator("textarea"),
    page.locator('[contenteditable="true"][role="textbox"]'),
    page.locator('[contenteditable="true"]'),
  ]);
}

export async function freshChat(page: Page) {
  await openGemini(page);
  try {
    const button = await firstVisible([
      page.getByRole("button", { name: /new chat|new conversation/i }),
      page.locator('[aria-label*="New chat" i]'),
    ]);
    await button.click();
    await page.waitForTimeout(1_200);
  } catch {}
}

export async function openImageGenerationMode(page: Page) {
  const existingComposer = page.locator('textarea, [contenteditable="true"]');
  if (await existingComposer.count() > 0 && await existingComposer.first().isVisible().catch(() => false)) {
    return;
  }

  try {
    const images = await firstVisible([
      page.getByRole("link", { name: /^Images$/i }),
      page.getByRole("button", { name: /^Images$/i }),
      page.getByText("Images", { exact: true }),
    ]);
    await images.click();
    await pause(1_800, "Opening Gemini image generation mode");
  } catch {
    console.log("Gemini Images entry was not found; continuing with current Gemini composer.");
  }

  const createCard = page.locator('[data-test-id="image-creation-discovery-card"]');
  if (await createCard.count() > 0 && await createCard.first().isVisible().catch(() => false)) {
    console.log("Gemini image-generation discovery card detected; opening it.");
    try {
      await createCard.first().click({ force: true, timeout: 5_000 });
    } catch {
      await createCard.first().evaluate((el) => (el as HTMLElement).click());
    }
    await page.waitForTimeout(1_800);
    return;
  }

  const createText = page.getByText("Create images", { exact: true });
  if (await createText.count() > 0 && await createText.first().isVisible().catch(() => false)) {
    console.log("Gemini Create images entry detected; opening it.");
    try {
      await createText.first()
        .locator("xpath=ancestor::*[@data-test-id='image-creation-discovery-card'][1]")
        .click({ force: true, timeout: 5_000 });
    } catch {
      await createText.first().evaluate((el) =>
        (el.parentElement?.parentElement as HTMLElement | null)?.click()
      );
    }
    await page.waitForTimeout(1_800);
  }
}

async function clickAddFiles(page: Page) {
  const controls = [
    page.getByRole("button", { name: /open upload file menu|add files|attach files|upload files/i }),
    page.locator('button[aria-label="Open upload file menu"]'),
    page.locator('button[aria-label*="Upload" i]'),
    page.locator('button[aria-label*="Attach" i]'),
    page.locator('button[aria-label*="Add file" i]'),
    page.locator('[role="button"][aria-label*="Upload" i]'),
    page.locator('[role="button"][aria-label*="Attach" i]'),
  ];

  for (const locator of controls) {
    try {
      const button = await firstVisible([locator]);
      await button.click();
      return;
    } catch {}
  }

  const iconButton = page.locator('mat-icon[data-mat-icon-name="add_2"], mat-icon[fonticon="add"]');
  try {
    const icon = await firstVisible([iconButton]);
    await firstVisible([icon.locator("xpath=ancestor::button[1]")]).then((button) => button.click());
    return;
  } catch {}

  throw new Error("Could not find Gemini Add files control.");
}

export async function uploadReference(page: Page, imagePath: string) {
  const tryFileInputs = async () => {
    const inputs = page.locator('input[type="file"]');
    const count = await inputs.count();
    for (let i = 0; i < count; i += 1) {
      try {
        await inputs.nth(i).setInputFiles(imagePath);
        await pause(2_500, "Reference image uploaded; waiting for Gemini to register it");
        return true;
      } catch {}
    }
    return false;
  };

  // Gemini can expose the native file input before the upload menu is opened,
  // after the menu is opened, or only after the menu item is activated.
  if (await tryFileInputs()) return;

  // Some current Gemini builds open the native OS file chooser directly from
  // the "Upload and tools" button. The previous implementation clicked the button
  // first and only listened for a chooser after it had already fired, which made a
  // valid upload path look like "no usable local-file upload control".
  const directChooser = page.waitForEvent("filechooser", { timeout: 10_000 }).catch(() => null);
  await clickAddFiles(page);
  const chooser = await directChooser;
  if (chooser) {
    await chooser.setFiles(imagePath);
    await pause(2_500, "Reference image uploaded; waiting for Gemini to register it");
    return;
  }

  await pause(900, "Upload menu opened; waiting for the file control");

  // Prefer the native file input when Gemini has injected it into the DOM.
  if (await tryFileInputs()) return;

  const menuCandidates = [
    page.getByRole("menuitem", { name: /upload files|files|from computer|upload from computer/i }),
    page.getByRole("button", { name: /upload files|files|from computer|upload from computer/i }),
    page.getByText(/upload files|from computer|upload from computer/i),
    page.locator('[data-test-id*="local" i][data-test-id*="file" i]'),
    page.locator('[data-test-id*="upload" i][data-test-id*="file" i]'),
  ];

  for (const locator of menuCandidates) {
    try {
      const count = await locator.count();
      for (let i = count - 1; i >= 0; i -= 1) {
        const item = locator.nth(i);
        if (!(await item.isVisible().catch(() => false))) continue;

        const chooserPromise = page
          .waitForEvent("filechooser", { timeout: 5_000 })
          .catch(() => null);

        await item.click({ force: true, timeout: 5_000 }).catch(async () => {
          await item.click({ timeout: 5_000 });
        });

        const chooser = await chooserPromise;
        if (chooser) {
          await chooser.setFiles(imagePath);
          await pause(2_500, "Reference image uploaded; waiting for Gemini to register it");
          return;
        }

        await page.waitForTimeout(700);
        if (await tryFileInputs()) return;
      }
    } catch {}
  }

  // Last-resort diagnostic: expose the controls Gemini actually rendered.
  const controls = await page.evaluate(() =>
    Array.from(document.querySelectorAll("input,button,[role='button'],[role='menuitem']"))
      .map((el) => ({
        tag: el.tagName,
        type: el.getAttribute("type"),
        role: el.getAttribute("role"),
        aria: el.getAttribute("aria-label"),
        text: (el.textContent || "").trim().slice(0, 120),
        testId: el.getAttribute("data-test-id"),
      }))
      .filter((item) =>
        /upload|attach|file|computer|local/i.test(
          [item.aria, item.text, item.testId].filter(Boolean).join(" ")
        )
      )
      .slice(0, 30)
  );

  console.error(`Gemini upload controls detected: ${JSON.stringify(controls)}`);
  throw new Error("Gemini did not expose a usable local-file upload control.");
}

async function composer(page: Page): Promise<Locator> {
  return firstVisible([
    page.locator("textarea"),
    page.locator('[contenteditable="true"][role="textbox"]'),
    page.locator('[contenteditable="true"]'),
    page.locator('textarea[placeholder*="Enter a prompt" i]'),
    page.locator('textarea[placeholder*="Ask Gemini" i]'),
  ]);
}

export async function submitPrompt(page: Page, prompt: string) {
  const box = await composer(page);
  await pause(1_200, "Reference ready; preparing prompt");
  await box.fill(prompt);
  await pause(1_000, "Prompt entered; preparing submission");

  for (const locator of [
    page.getByRole("button", { name: /send|submit/i }),
    page.locator('button[aria-label="Send message"]'),
    page.locator('button[aria-label*="Send" i]'),
    page.locator('button[type="submit"]'),
  ]) {
    try {
      const button = await firstVisible([locator]);
      await button.click({ timeout: 10_000 });
      return;
    } catch {}
  }

  await box.press("Enter");
}

export async function largeImages(page: Page): Promise<string[]> {
  return page.evaluate(() => Array.from(document.images)
    .map((img) => ({ src: img.currentSrc || img.src, area: img.naturalWidth * img.naturalHeight }))
    .filter((item) => item.src && item.area >= 512 * 512)
    .sort((a, b) => b.area - a.area)
    .map((item) => item.src));
}

export async function waitForGeneratedImage(page: Page, before: Set<string>): Promise<string> {
  await pause(3_500, "Gemini is processing the request");
  const deadline = Date.now() + 180_000;
  let lastLog = 0;

  while (Date.now() < deadline) {
    const sources = await largeImages(page);
    const generatedSource = sources
      .map((value) => typeof value === "string" ? value : (value as { src?: string }).src ?? "")
      .find((src) => src && !before.has(src));
    if (generatedSource) {
      console.log("New generated image detected in Gemini.");
      return generatedSource;
    }
    if (Date.now() - lastLog >= 10_000) {
      console.log("Still waiting for Gemini to finish processing...");
      lastLog = Date.now();
    }
    await page.waitForTimeout(1_000);
  }

  throw new Error("Timed out waiting for a new generated image from Gemini.");
}

export async function captureGeneratedImage(page: Page, outputPath: string, source: string | { src?: string } | undefined, before: Set<string> = new Set()) {
  // Normalize the detected asset so older/newer Gemini DOM return shapes cannot
  // break the worker at the capture boundary.
  let resolvedSource = typeof source === "string" ? source : source?.src ?? "";
  if (!resolvedSource) {
    console.log(`Gemini capture source was empty (type=${typeof source}); re-resolving from current generated images.`);
    const currentSources = await largeImages(page);
    resolvedSource = currentSources.find((candidate) => candidate && !before.has(candidate)) ?? "";
  }
  if (!resolvedSource) throw new Error("Gemini generated image source was empty after re-resolution.");
  source = resolvedSource;
  // Capture only the exact generated asset detected after submission.
  // Never click Gemini download controls: they can select/navigate to a stale
  // or unrelated image in the persistent Gemini UI.
  if (source.startsWith("data:")) {
    const base64 = source.split(",", 2)[1];
    if (!base64) throw new Error("Invalid data URL returned by Gemini.");
    await writeFile(outputPath, Buffer.from(base64, "base64"));
    console.log("Generated image captured from exact data URL.");
    return;
  }

  if (source.startsWith("blob:")) {
    try {
      const base64 = await page.evaluate(async (blobUrl) => {
        const response = await fetch(blobUrl);
        if (!response.ok) throw new Error(`Blob fetch failed: HTTP ${response.status}`);
        const blob = await response.blob();
        return await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const value = reader.result;
            if (typeof value !== "string") return reject(new Error("Blob conversion did not produce a data URL."));
            const comma = value.indexOf(",");
            if (comma < 0) return reject(new Error("Invalid blob data URL."));
            resolve(value.slice(comma + 1));
          };
          reader.onerror = () => reject(reader.error ?? new Error("Failed to read blob."));
          reader.readAsDataURL(blob);
        });
      }, source);
      await writeFile(outputPath, Buffer.from(base64, "base64"));
      console.log("Generated image captured from exact blob asset.");
      return;
    } catch {
      console.log("Direct blob fetch failed; capturing exact generated image element instead.");
    }
  }

  if (source.startsWith("http")) {
    const response = await page.request.get(source);
    if (response.ok()) {
      await writeFile(outputPath, await response.body());
      console.log("Generated image captured from exact generated HTTP asset.");
      return;
    }
  }

  // Final fallback still targets the exact source URL captured at detection time.
  const index = await page.locator("img").evaluateAll((images, target) =>
    images.findIndex((image) => {
      const element = image as HTMLImageElement;
      return (element.currentSrc || element.src) === target;
    }), source);

  if (index < 0) throw new Error("Exact generated image element not found.");

  const image = page.locator("img").nth(index);
  await image.scrollIntoViewIfNeeded();
  await image.screenshot({ path: outputPath });
  console.log("Generated image captured from the exact rendered Gemini image element.");
}
