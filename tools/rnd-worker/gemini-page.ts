import { createHash } from "node:crypto";
import { type ElementHandle, type Locator, type Page } from "playwright";
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

export class GeminiConversationError extends Error {}

const USER_TURN = "user-query";
const ASSISTANT_TURN = "model-response";
const TURN_GROUP = "conversation-turn, .conversation-container, [data-test-id='conversation-turn']";
const GENERATED_IMAGE = "generated-image img, image-generation-image img, [data-test-id='generated-image'] img, img[data-test-id='generated-image']";
const CONVERSATION_PATH = /^\/(?:u\/\d+\/)?app(?:\/([\w-]+))?\/?$/;

function geminiPath(url: string): string | null {
  const parsed = new URL(url);
  return parsed.origin === new URL(GEMINI_URL).origin && CONVERSATION_PATH.test(parsed.pathname)
    ? parsed.pathname : null;
}

async function assertEmptyConversation(page: Page) {
  const pathname = geminiPath(page.url());
  if (!pathname || CONVERSATION_PATH.exec(pathname)?.[1] || await page.locator(USER_TURN + ", " + ASSISTANT_TURN).count()) {
    throw new GeminiConversationError("Gemini fresh conversation boundary is not verified.");
  }
  await composer(page).catch(() => { throw new GeminiConversationError("Gemini fresh composer is unavailable."); });
  return pathname;
}

export async function freshChat(page: Page, timeout = 10_000) {
  try {
    const control = await firstVisible([
      page.getByRole("button", { name: /^(new chat|new conversation)$/i }),
      page.getByRole("link", { name: /^(new chat|new conversation)$/i }),
    ]);
    await control.click({ timeout });
    await page.waitForURL(url => {
      const pathname = geminiPath(url.href);
      return pathname !== null && !CONVERSATION_PATH.exec(pathname)?.[1];
    }, { timeout });
    await page.locator(USER_TURN + ", " + ASSISTANT_TURN).first().waitFor({ state: "detached", timeout });
    const pathname = await assertEmptyConversation(page);
    console.log("Gemini fresh conversation verified (empty composer view).");
    return pathname;
  } catch {
    throw new GeminiConversationError("Gemini new chat could not be verified.");
  }
}

export class GeminiModelSelectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GeminiModelSelectionError";
  }
}

async function openGeminiModePicker(page: Page) {
  // Reuse the historical mode-picker button and semantic option roles.
  const picker = page.getByRole("button", { name: /^open mode picker\b/i }).or(
    page.locator('button[aria-label^="Open mode picker" i], [role="button"][aria-label^="Open mode picker" i]'),
  ).or(page.getByRole("button", { name: "Pro", exact: true })).filter({ visible: true });
  try {
    await picker.click({ timeout: 10_000 });
  } catch {
    throw new GeminiModelSelectionError("Could not open the Gemini mode picker to verify 3.1 Pro.");
  }

  const options = page.locator('[role="menuitem"], [role="menuitemradio"], [role="option"]').filter({ visible: true });
  const exactName = /^3\.1 Pro$/;
  const named = page.getByRole("menuitem", { name: exactName })
    .or(page.getByRole("menuitemradio", { name: exactName }))
    .or(page.getByRole("option", { name: exactName }));
  // Some historical GEM-MENU-ITEM rows include a description in their accessible name.
  const exactLabel = options.filter({ has: page.getByText("3.1 Pro", { exact: true }) });
  const option = options.and(named.or(exactLabel));
  try {
    await option.waitFor({ state: "visible", timeout: 5_000 });
  } catch {
    throw new GeminiModelSelectionError("The Gemini mode picker did not expose one exact 3.1 Pro option.");
  }
  return { option, options };
}

async function hasExactGeminiSelection(page: Page, { option, options }: Awaited<ReturnType<typeof openGeminiModePicker>>) {
  const selected = options.and(page.locator('[aria-checked="true"], [aria-selected="true"]'));
  const conflicting = option.and(page.locator('[aria-checked="false"], [aria-selected="false"]'));
  return await selected.count() === 1 && await selected.and(option).count() === 1 && await conflicting.count() === 0;
}

async function closeGeminiModePicker(page: Page, option: Locator) {
  try {
    await page.keyboard.press("Escape");
    await option.waitFor({ state: "hidden", timeout: 3_000 });
  } catch {
    throw new GeminiModelSelectionError("Could not close the verified Gemini mode picker safely.");
  }
}

export async function verifyGemini31Pro(page: Page) {
  const controls = await openGeminiModePicker(page);
  if (!await hasExactGeminiSelection(page, controls)) {
    throw new GeminiModelSelectionError("Gemini 3.1 Pro is unverified: the exact option does not have an unambiguous selected state.");
  }
  await closeGeminiModePicker(page, controls.option);
}

export async function selectGemini31Pro(page: Page) {
  const controls = await openGeminiModePicker(page);
  if (await hasExactGeminiSelection(page, controls)) {
    await closeGeminiModePicker(page, controls.option);
    return;
  }

  try {
    await controls.option.click({ timeout: 10_000 });
  } catch {
    throw new GeminiModelSelectionError("Could not select the exact Gemini 3.1 Pro option.");
  }
  // Clicking the option can close or rerender the menu. Reopen and obtain
  // fresh locators so the original click or a generic Pro label is never proof.
  try {
    await controls.option.waitFor({ state: "hidden", timeout: 1_000 });
  } catch {
    await closeGeminiModePicker(page, controls.option);
  }
  await verifyGemini31Pro(page);
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

type TurnNode = ElementHandle<SVGElement | HTMLElement>;
type VerifiedGeminiTurn = { path: string; user: TurnNode; assistant: TurnNode };
type GeminiImage = { src: string; width: number; height: number };

async function inspectTurn(page: Page, turn?: Pick<VerifiedGeminiTurn, "user" | "assistant">) {
  return page.evaluate(({ userSelector, assistantSelector, groupSelector, imageSelector, expectedUser, expectedAssistant }) => {
    const users = document.querySelectorAll(userSelector);
    const responses = document.querySelectorAll(assistantSelector);
    const user = users[0], assistant = responses[0];
    const group = user?.closest(groupSelector);
    if (users.length !== 1 || responses.length !== 1 || !group || assistant.closest(groupSelector) !== group ||
        !(user.compareDocumentPosition(assistant) & Node.DOCUMENT_POSITION_FOLLOWING) ||
        (expectedUser && user !== expectedUser) || (expectedAssistant && assistant !== expectedAssistant)) return null;

    const query = user.querySelector<HTMLElement>(".query-text, [data-test-id='user-query-text']");
    if (!query || !query.getClientRects().length || !assistant.getClientRects().length) return null;
    const images = Array.from(assistant.querySelectorAll<HTMLImageElement>(imageSelector));
    const image = images.length === 1 ? images[0] : null;
    const src = image?.currentSrc;
    const responseText = assistant.querySelector("message-content")?.textContent?.trim();
    return {
      pathname: location.pathname,
      prompt: query.innerText,
      started: Boolean(assistant.matches('[aria-busy="true"]') || assistant.querySelector('[aria-busy="true"]') || responseText || image),
      image: image && src && src === image.src && !image.srcset && !image.closest("picture") &&
        image.complete && image.naturalWidth >= 512 && image.naturalHeight >= 512 && image.getClientRects().length
        ? { src, width: image.naturalWidth, height: image.naturalHeight } : null,
    };
  }, { userSelector: USER_TURN, assistantSelector: ASSISTANT_TURN, groupSelector: TURN_GROUP, imageSelector: GENERATED_IMAGE,
    expectedUser: turn?.user, expectedAssistant: turn?.assistant });
}

const renderedPrompt = (value: string) => value.replace(/\s+/g, " ").trim();

export async function prepareGeminiSubmission(page: Page, freshPath: string) {
  if (await assertEmptyConversation(page) !== freshPath) {
    throw new GeminiConversationError("Gemini conversation changed before prompt submission.");
  }
}

export async function submitPrompt(page: Page, prompt: string, freshPath: string, timeout = 30_000): Promise<VerifiedGeminiTurn> {
  try {
    await prepareGeminiSubmission(page, freshPath);
    const box = await composer(page);
    await box.fill(prompt);
    const button = await firstVisible([
      page.getByRole("button", { name: /^(send|send message|submit)$/i }),
    ]).catch(() => null);
    if (button) await button.click({ timeout: 10_000 });
    else await box.press("Enter");

    const deadline = Date.now() + timeout;
    do {
      const current = await inspectTurn(page);
      if (current && geminiPath(page.url()) === current.pathname && CONVERSATION_PATH.exec(current.pathname)?.[1] &&
          renderedPrompt(current.prompt) === renderedPrompt(prompt) && current.started) {
        const user = await page.locator(USER_TURN).elementHandle({ timeout: 1_000 });
        const assistant = await page.locator(ASSISTANT_TURN).elementHandle({ timeout: 1_000 });
        const turn = { path: current.pathname, user, assistant };
        const verified = await inspectTurn(page, turn);
        if (verified?.pathname === turn.path && verified.started && renderedPrompt(verified.prompt) === renderedPrompt(prompt)) {
          console.log("Gemini prompt and assistant turn verified", { conversation: turn.path, userTurn: 1, assistantTurnOrdinal: 1 });
          return turn;
        }
        await Promise.all([user.dispose(), assistant.dispose()]);
      }
      if (await detectGeminiProfileExhaustion(page)) throw new Error(GEMINI_QUOTA_ERROR);
      if (Date.now() < deadline) await page.waitForTimeout(150);
    } while (Date.now() < deadline);
  } catch (error) {
    if (error instanceof Error && error.message === GEMINI_QUOTA_ERROR) throw error;
  }
  throw new GeminiConversationError("Gemini did not verify the submitted prompt and its new assistant turn.");
}

const GEMINI_QUOTA_MESSAGE = "I can create more images as soon as your limit resets. Check your usage in Settings.";

async function detectGeminiProfileExhaustion(page: Page): Promise<boolean> {
  const bodyText = await page.locator("body").innerText().catch(() => "");
  const normalized = bodyText.replace(/\s+/g, " ").trim().toLowerCase();
  if (normalized.includes(GEMINI_QUOTA_MESSAGE.toLowerCase())) return true;
  return /(?:usage limit|limit reached|too many requests|rate limit|resource exhausted|quota exceeded)/i.test(normalized);
}

const GEMINI_QUOTA_ERROR = "GEMINI_PROFILE_EXHAUSTED: Gemini image-generation quota is exhausted for the active profile.";

export async function waitForGeneratedImage(page: Page, turn: VerifiedGeminiTurn, timeout = 300_000): Promise<GeminiImage> {
  const deadline = Date.now() + timeout;
  try {
    do {
      if (await detectGeminiProfileExhaustion(page)) throw new Error(GEMINI_QUOTA_ERROR);
      const current = await inspectTurn(page, turn);
      if (current?.pathname !== turn.path || geminiPath(page.url()) !== turn.path) {
        throw new GeminiConversationError("Gemini current assistant turn changed during capture.");
      }
      if (current.image) return current.image;
      if (Date.now() < deadline) await page.waitForTimeout(250);
    } while (Date.now() < deadline);
  } catch (error) {
    if (error instanceof GeminiConversationError || error instanceof Error && error.message === GEMINI_QUOTA_ERROR) throw error;
    throw new GeminiConversationError("Gemini current assistant turn could not be inspected.");
  }
  throw new GeminiConversationError("Timed out waiting for a verified image in the current Gemini assistant turn.");
}

async function readImageBytes(page: Page, src: string) {
  const url = new URL(src);
  if (url.protocol === "data:") {
    const match = /^data:(image\/(?:png|jpeg|webp));base64,([a-z0-9+/=]+)$/i.exec(src);
    if (!match) throw new Error("Unsupported inline image.");
    return { mime: match[1].toLowerCase(), bytes: Buffer.from(match[2], "base64") };
  }
  if (url.protocol === "blob:" && url.origin === new URL(GEMINI_URL).origin) {
    const blob = await page.evaluate(async source => {
      const response = await fetch(source);
      if (!response.ok) throw new Error("Blob read failed.");
      const value = await response.blob();
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject();
        reader.onerror = () => reject();
        reader.readAsDataURL(value);
      });
    }, src);
    return readImageBytes(page, blob);
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port ||
      (url.hostname !== "gemini.google.com" && !url.hostname.endsWith(".googleusercontent.com"))) {
    throw new Error("Unrecognized Gemini image source.");
  }
  const response = await page.request.get(src, { maxRedirects: 0, timeout: 30_000 });
  try {
    if (!response.ok()) throw new Error("Image request failed.");
    return { mime: response.headers()["content-type"]?.split(";")[0].toLowerCase(), bytes: await response.body() };
  } finally {
    await response.dispose();
  }
}

export async function captureGeneratedImage(page: Page, outputBasePath: string, turn: VerifiedGeminiTurn, image: GeminiImage) {
  try {
    const { src, width, height } = image;
    const { bytes, mime } = await readImageBytes(page, src);
    const extension = mime === "image/png" ? "png" : mime === "image/jpeg" ? "jpg" : mime === "image/webp" ? "webp" : null;
    if (!extension || !bytes.length || bytes.length > 15 * 1024 * 1024) throw new Error("Unsupported image bytes.");
    const dimensions = await page.evaluate(async ({ base64, type }) => {
      const bitmap = await createImageBitmap(new Blob([Uint8Array.from(atob(base64), byte => byte.charCodeAt(0))], { type }));
      try { return { width: bitmap.width, height: bitmap.height }; } finally { bitmap.close(); }
    }, { base64: bytes.toString("base64"), type: mime });
    const current = await inspectTurn(page, turn);
    if (current?.pathname !== turn.path || geminiPath(page.url()) !== turn.path || current.image?.src !== src ||
        current.image.width !== width || current.image.height !== height ||
        dimensions.width !== width || dimensions.height !== height) throw new Error("Image evidence changed.");
    const filePath = outputBasePath + "." + extension;
    await writeFile(filePath, bytes);
    const checksum = createHash("sha256").update(bytes).digest("hex");
    console.log("Gemini current-turn image captured", { conversation: turn.path, assistantTurnOrdinal: 1, image: 1, width, height, checksum });
    return { filePath, checksum };
  } catch {
    throw new GeminiConversationError("Gemini image bytes could not be verified at the current turn's intrinsic resolution.");
  }
}
