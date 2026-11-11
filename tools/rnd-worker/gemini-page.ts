import { createHash } from "node:crypto";
import { type Download, type ElementHandle, type JSHandle, type Locator, type Page } from "playwright";
import { mkdir, mkdtemp, readFile, rename, stat } from "node:fs/promises";
import path from "node:path";

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
    // Gemini adds a screen-reader summary and renders prompt lines separately.
    // Read a detached copy so offscreen content-visibility cannot erase the text.
    const promptContent = query.cloneNode(true) as HTMLElement;
    promptContent.querySelectorAll(".screen-reader-user-query-label").forEach(label => label.remove());
    promptContent.querySelectorAll("br").forEach(lineBreak => lineBreak.replaceWith("\n"));
    promptContent.querySelectorAll(".query-text-line").forEach(line => line.append("\n"));
    for (const list of promptContent.querySelectorAll<HTMLOListElement>("ol.query-numbered-list")) {
      let ordinal = list.start;
      for (const item of Array.from(list.children) as HTMLLIElement[]) {
        if (!item.matches("li.query-numbered-item")) return null;
        if (item.hasAttribute("value")) ordinal = item.value;
        item.prepend(`${ordinal}. `);
        item.append("\n");
        ordinal++;
      }
    }
    const images = Array.from(assistant.querySelectorAll<HTMLImageElement>(imageSelector));
    const image = images.length === 1 ? images[0] : null;
    const src = image?.currentSrc;
    const responseText = assistant.querySelector("message-content")?.textContent?.trim();
    return {
      pathname: location.pathname,
      prompt: promptContent.textContent ?? "",
      started: Boolean(assistant.matches('[aria-busy="true"]') || assistant.querySelector('[aria-busy="true"]') || responseText || image),
      image: image && src &&
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
  let verification = "DISPATCH_UNCONFIRMED";
  try {
    await prepareGeminiSubmission(page, freshPath);
    const box = await composer(page);
    await box.fill(prompt);
    const button = await firstVisible([
      page.getByRole("button", { name: /^(send|send message|submit)$/i }),
    ]).catch(() => null);
    if (button) await button.click({ timeout: 10_000 });
    else await box.press("Enter");
    verification = "TURN_ASSOCIATION_UNVERIFIED";

    const deadline = Date.now() + timeout;
    do {
      const current = await inspectTurn(page);
      if (current) {
        verification = renderedPrompt(current.prompt) !== renderedPrompt(prompt) ? "PROMPT_MISMATCH" :
          !current.started ? "ASSISTANT_NOT_STARTED" : "CONVERSATION_UNVERIFIED";
      }
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
    verification = page.isClosed() ? "BROWSER_CLOSED" : "DOM_INSPECTION_FAILED";
  }
  throw new GeminiConversationError(`Gemini did not verify the submitted prompt and its new assistant turn. [${verification}]`);
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

type CaptureStage = "TURN" | "CONTROL" | "DOWNLOAD" | "PERSIST" | "VALIDATE";
export class GeminiCaptureError extends GeminiConversationError {
  constructor(readonly code: string, readonly stage: CaptureStage) {
    super(`${code}: Gemini native full-size capture failed at ${stage}; retain the submission for reconciliation.`);
    this.name = "GeminiCaptureError";
  }
}

const activeCaptures = new WeakSet<Page>();
const FULL_SIZE_DOWNLOAD = /^(?:download(?: image)? full[- ]size(?: image)?|download original(?: image)?|download image in full size)$/i;

function trustedDownloadUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol === "blob:") return url.origin === new URL(GEMINI_URL).origin;
    return url.protocol === "https:" && !url.username && !url.password && !url.port &&
      (url.hostname === "gemini.google.com" || url.hostname.endsWith(".googleusercontent.com"));
  } catch { return false; }
}

function downloadedImageType(bytes: Buffer) {
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return { mime: "image/png", extension: "png", headerSize: 33 };
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return { mime: "image/jpeg", extension: "jpg", headerSize: 4 };
  if (bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") return { mime: "image/webp", extension: "webp", headerSize: 20 };
  return null;
}

export async function captureGeneratedImage(page: Page, outputBasePath: string, turn: VerifiedGeminiTurn, image: GeminiImage, timeout = 60_000) {
  if (activeCaptures.has(page)) throw new GeminiCaptureError("RND_CAPTURE_ALREADY_ACTIVE", "TURN");
  activeCaptures.add(page);
  let stage: CaptureStage = "TURN";
  let active = true;
  const downloads: Download[] = [];
  const handles: TurnNode[] = [];
  let generated: TurnNode | null = null;
  let clickGuard: JSHandle<{ clicks: number; otherClick: boolean; dispose: () => void }> | undefined;
  const checkActive = () => {
    if (!active) throw new GeminiCaptureError("RND_CAPTURE_TIMEOUT", stage);
    if (page.isClosed()) throw new GeminiCaptureError("RND_CAPTURE_BROWSER_CLOSED", stage);
  };
  const verifyTurn = async () => {
    checkActive();
    const current = await inspectTurn(page, turn);
    checkActive();
    if (current?.pathname !== turn.path || geminiPath(page.url()) !== turn.path ||
        current.image?.src !== image.src || current.image.width !== image.width || current.image.height !== image.height) {
      throw new GeminiCaptureError("RND_CAPTURE_TURN_CHANGED", stage);
    }
    if (generated && !(await generated.evaluate((el, assistant) => el.isConnected && el.closest("model-response") === assistant, turn.assistant))) {
      throw new GeminiCaptureError("RND_CAPTURE_TURN_CHANGED", stage);
    }
  };
  let timer: ReturnType<typeof setTimeout>;
  let rejectClosed!: (error: Error) => void;
  const closed = new Promise<never>((_, reject) => { rejectClosed = reject; });
  const onClose = () => rejectClosed(new GeminiCaptureError("RND_CAPTURE_BROWSER_CLOSED", stage));
  const onDownload = (download: Download) => { downloads.push(download); };
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new GeminiCaptureError("RND_CAPTURE_TIMEOUT", stage)), timeout);
  });
  page.on("close", onClose);
  page.on("crash", onClose);
  try {
    return await Promise.race([closed, deadline, (async () => {
      await verifyTurn();
      stage = "CONTROL";
      generated = await turn.assistant.$(GENERATED_IMAGE);
      if (!generated) throw new GeminiCaptureError("RND_CAPTURE_TURN_CHANGED", stage);
      handles.push(generated);
      await generated.hover({ timeout });
      checkActive();
      const controls = await turn.assistant.$$("button, [role='button'], a[download]");
      handles.push(...controls);
      const matching: TurnNode[] = [];
      for (const control of controls) {
        const labels = await control.evaluate(el => [el.getAttribute("aria-label"), el.getAttribute("title"),
          el.getAttribute("mattooltip"), el.getAttribute("data-tooltip"), el.textContent]);
        if (labels.some(label => label && FULL_SIZE_DOWNLOAD.test(label.replace(/\s+/g, " ").trim()))) matching.push(control);
      }
      checkActive();
      if (matching.length !== 1) throw new GeminiCaptureError(matching.length ? "RND_CAPTURE_DUPLICATE_CONTROLS" : "RND_CAPTURE_CONTROL_UNAVAILABLE", stage);
      const control = matching[0];
      if (!(await control.isVisible()) || !(await control.isEnabled())) throw new GeminiCaptureError("RND_CAPTURE_CONTROL_UNAVAILABLE", stage);
      const owned = await control.evaluate((el, expected) => {
        if (!el.isConnected || el.closest("model-response") !== expected.assistant) return false;
        let widget = expected.image.closest("generated-image, image-generation-image, [data-test-id='generated-image']");
        while (widget && widget !== expected.assistant) {
          if (widget.contains(el)) return true;
          widget = widget.parentElement?.closest("generated-image, image-generation-image, [data-test-id='generated-image']") ?? null;
        }
        return false;
      }, { assistant: turn.assistant, image: generated });
      if (!owned) throw new GeminiCaptureError("RND_CAPTURE_CONTROL_NOT_ASSOCIATED", stage);
      await verifyTurn();
      stage = "DOWNLOAD";
      clickGuard = await page.evaluateHandle(({ control, assistant }) => {
        // Object methods remain self-contained when tsx serializes this callback
        // into the browser; named nested arrows can acquire Node-only helpers.
        const state = {
          clicks: 0, otherClick: false,
          handleEvent(event: MouseEvent) {
            if (!event.isTrusted) return; // Ignore the site's synthetic native-download anchor.
            if (event.composedPath().includes(control) && control.closest("model-response") === assistant) state.clicks++;
            else state.otherClick = true;
          },
          dispose() { document.removeEventListener("click", state, true); },
        };
        document.addEventListener("click", state, true);
        return state;
      }, { control, assistant: turn.assistant });
      const verifyClick = async () => {
        const state = await clickGuard!.evaluate(value => ({ clicks: value.clicks, otherClick: value.otherClick }));
        if (state.clicks !== 1 || state.otherClick) throw new GeminiCaptureError("RND_CAPTURE_UNEXPECTED_DOWNLOAD", stage);
      };
      // Arm both listeners BEFORE the one native click. No source URL is fetched,
      // and no generic page-wide download control or lower-resolution fallback exists.
      page.on("download", onDownload);
      const downloadPromise = page.waitForEvent("download", { timeout });
      const [download] = await Promise.all([downloadPromise, control.click({ timeout })]);
      checkActive();
      if (downloads.length !== 1 || download.page() !== page || !trustedDownloadUrl(download.url())) {
        throw new GeminiCaptureError("RND_CAPTURE_UNEXPECTED_DOWNLOAD", stage);
      }
      await verifyClick();
      await verifyTurn();
      stage = "PERSIST";
      await mkdir(path.dirname(outputBasePath), { recursive: true });
      const directory = await mkdtemp(path.join(path.dirname(outputBasePath), "gemini-capture-"));
      const pendingPath = path.join(directory, "original.download");
      checkActive();
      try {
        // saveAs completes the copy outside Chrome's context-owned temp directory.
        await download.saveAs(pendingPath);
      } catch {
        const failure = await download.failure().catch(() => null);
        throw new GeminiCaptureError(failure && /cancel/i.test(failure) ? "RND_CAPTURE_DOWNLOAD_CANCELLED" : "RND_CAPTURE_SAVE_FAILED", stage);
      }
      checkActive();
      const failure = await download.failure();
      if (failure) throw new GeminiCaptureError(/cancel/i.test(failure) ? "RND_CAPTURE_DOWNLOAD_CANCELLED" : "RND_CAPTURE_DOWNLOAD_FAILED", stage);
      stage = "VALIDATE";
      const info = await stat(pendingPath);
      if (!info.isFile() || info.size <= 0 || info.size > 15 * 1024 * 1024) throw new GeminiCaptureError("RND_CAPTURE_INVALID_SIZE", stage);
      const bytes = await readFile(pendingPath);
      if (bytes.length !== info.size) throw new GeminiCaptureError("RND_CAPTURE_INVALID_SIZE", stage);
      const type = downloadedImageType(bytes);
      if (!type) throw new GeminiCaptureError("RND_CAPTURE_INVALID_MIME", stage);
      if (bytes.length < type.headerSize) throw new GeminiCaptureError("RND_CAPTURE_INVALID_SIZE", stage);
      const dimensions = await page.evaluate(async ({ base64, mime }) => {
        const bitmap = await createImageBitmap(new Blob([Uint8Array.from(atob(base64), byte => byte.charCodeAt(0))], { type: mime }));
        try { return { width: bitmap.width, height: bitmap.height }; } finally { bitmap.close(); }
      }, { base64: bytes.toString("base64"), mime: type.mime });
      checkActive();
      // Full-size may exceed the responsive preview. Never accept fewer pixels
      // or a changed aspect ratio; allow only one preview pixel of resize rounding.
      if (dimensions.width < image.width || dimensions.height < image.height || dimensions.width < 512 || dimensions.height < 512 ||
          Math.abs(dimensions.width * image.height - dimensions.height * image.width) > Math.max(dimensions.width, dimensions.height)) {
        throw new GeminiCaptureError("RND_CAPTURE_INVALID_DIMENSIONS", stage);
      }
      await verifyTurn();
      if (downloads.length !== 1) throw new GeminiCaptureError("RND_CAPTURE_UNEXPECTED_DOWNLOAD", stage);
      const checksum = createHash("sha256").update(bytes).digest("hex");
      const filePath = path.join(directory, "original." + type.extension);
      await rename(pendingPath, filePath);
      checkActive();
      await verifyTurn();
      await verifyClick();
      if (downloads.length !== 1) throw new GeminiCaptureError("RND_CAPTURE_UNEXPECTED_DOWNLOAD", stage);
      console.log("Gemini current-turn image captured", { assistantTurnOrdinal: 1, image: 1,
        width: dimensions.width, height: dimensions.height, checksum });
      return { filePath, checksum, mimeType: type.mime, fileSize: bytes.length, width: dimensions.width, height: dimensions.height };
    })()]);
  } catch (error) {
    // The asynchronous operation above advances the stage before rejecting.
    const failedStage = stage as CaptureStage;
    const captureError = error instanceof GeminiCaptureError ? error : new GeminiCaptureError(
      page.isClosed() ? "RND_CAPTURE_BROWSER_CLOSED" : error instanceof Error && error.name === "TimeoutError" ? "RND_CAPTURE_TIMEOUT" :
        failedStage === "VALIDATE" ? "RND_CAPTURE_INVALID_IMAGE" : failedStage === "PERSIST" ? "RND_CAPTURE_SAVE_FAILED" : "RND_CAPTURE_DOWNLOAD_FAILED", failedStage);
    // No provider exception, URL, filename, page text or credential is logged.
    console.error("Gemini image capture diagnostic", { code: captureError.code, stage: captureError.stage });
    throw captureError;
  } finally {
    active = false;
    activeCaptures.delete(page);
    clearTimeout(timer!);
    page.off("close", onClose);
    page.off("crash", onClose);
    page.off("download", onDownload);
    if (clickGuard) {
      const guard = clickGuard;
      void guard.evaluate(state => state.dispose()).catch(() => undefined).finally(() => guard.dispose().catch(() => undefined));
    }
    for (const download of downloads) void download.cancel().catch(() => undefined);
    for (const handle of handles) void handle.dispose().catch(() => undefined);
  }
}
