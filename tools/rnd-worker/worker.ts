import { chromium, type BrowserContext, type Locator, type Page } from "playwright";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const API_BASE = (process.env.RND_API_BASE_URL ?? "https://draftmyhair-git-rnd-prompt-lab-v3-draftmyhair.vercel.app").replace(/\/$/, "");
const WORKER_TOKEN = process.env.RND_WORKER_TOKEN?.trim();
const WORKER_ID_FILE = process.env.RND_WORKER_ID_FILE ?? path.resolve(".rnd-worker-id");
const PROFILE_DIR = process.env.DMH_GEMINI_PROFILE_DIR ?? path.resolve("tools/gemini-web-agent/chrome-profile");
const OUTPUT_DIR = process.env.DMH_RND_OUTPUT_DIR ?? path.resolve("tools/rnd-worker/output");
const CHROME_PATH = process.env.CHROME_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const GEMINI_URL = "https://gemini.google.com/app";
const POLL_MS = 10_000;
const LEASE_HEARTBEAT_MS = 40_000;
const GENERATION_TIMEOUT_MS = 180_000;

if (!WORKER_TOKEN) throw new Error("RND_WORKER_TOKEN is required.");

interface SourceAsset {
  id: string;
  kind: string;
  storageKey: string;
  blobUrl: string;
  mimeType: string;
  fileSize: number;
  width: number | null;
  height: number | null;
  checksum: string;
}

interface ClaimedJob {
  id: string;
  targetId: string;
  status: string;
  promptVersionNumber: number | null;
  currentPrompt: string | null;
  attemptCount: number;\n  attemptNumber: number;
  target: {
    id: string;
    targetType: string;
    targetKey: string;
    hairstyleId: string | null;
    hairColorKey: string | null;
    beardKey: string | null;
    hardCoreInstruction: string | null;
    sourceAssetId: string;
  };
  sourceAsset: SourceAsset;
}

interface ClaimResponse { ok: boolean; workerId?: string; leaseExpiresAt?: string | null; job: ClaimedJob | null; }
interface HelloResponse { ok: boolean; protocolVersion: string; serverTime: string; }

async function api(pathname: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${WORKER_TOKEN}`);
  headers.set("X-RND-Worker-Id", await workerId());
  const response = await fetch(`${API_BASE}${pathname}`, { ...init, headers });
  return response;
}

let cachedWorkerId: string | null = null;
async function workerId() {
  if (cachedWorkerId) return cachedWorkerId;
  try {
    cachedWorkerId = (await readFile(WORKER_ID_FILE, "utf8")).trim() || null;
  } catch { /* first run */ }
  if (!cachedWorkerId) {
    cachedWorkerId = randomUUID();
    await writeFile(WORKER_ID_FILE, `${cachedWorkerId}\n`, "utf8");
  }
  return cachedWorkerId;
}

async function assertServer() {
  const response = await api("/api/rnd/worker/hello");
  if (!response.ok) throw new Error(`Worker hello failed: HTTP ${response.status} ${await response.text()}`);
  const body = await response.json() as HelloResponse;
  if (!body.ok || body.protocolVersion !== "1") throw new Error(`Unsupported worker protocol: ${JSON.stringify(body)}`);
  console.log(`Connected to R&D worker API ${API_BASE}; protocol ${body.protocolVersion}.`);
}

async function claim(): Promise<ClaimResponse> {
  const response = await api("/api/rnd/worker/claim", { method: "POST" });
  if (!response.ok) throw new Error(`Claim failed: HTTP ${response.status} ${await response.text()}`);
  return await response.json() as ClaimResponse;
}

async function heartbeat(jobId: string) {
  const response = await api("/api/rnd/worker/heartbeat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jobId }),
  });
  if (!response.ok) throw new Error(`Heartbeat failed: HTTP ${response.status} ${await response.text()}`);
}

async function report(job: ClaimedJob, attemptNumber: number, payload: Record<string, unknown>) {
  const response = await api("/api/rnd/worker/report", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jobId: job.id,
      attemptNumber,
      prompt: job.currentPrompt,
      promptRevision: promptRevision(job.currentPrompt ?? ""),
      ...payload,
    }),
  });
  if (!response.ok) throw new Error(`Report failed: HTTP ${response.status} ${await response.text()}`);
  return await response.json();
}

async function release(jobId: string) {
  const response = await api("/api/rnd/worker/release", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jobId }),
  });
  if (!response.ok) throw new Error(`Release failed: HTTP ${response.status} ${await response.text()}`);
}

function promptRevision(prompt: string) {
  return createHash("sha256").update(prompt, "utf8").digest("hex").slice(0, 16);
}

async function downloadSource(asset: SourceAsset, jobId: string) {
  const response = await api(`/api/rnd/worker/source?assetId=${encodeURIComponent(asset.id)}`);
  if (!response.ok) throw new Error(`Source download failed: HTTP ${response.status} ${await response.text()}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  const actualChecksum = createHash("sha256").update(buffer).digest("hex");
  if (actualChecksum !== asset.checksum) throw new Error(`Source checksum mismatch for ${asset.id}.`);
  const extension = asset.mimeType === "image/jpeg" ? "jpg" : asset.mimeType === "image/webp" ? "webp" : "png";
  const file = path.join(OUTPUT_DIR, `source-${jobId}.${extension}`);
  await writeFile(file, buffer);
  return file;
}

async function uploadArtifact(job: ClaimedJob, attemptNumber: number, filePath: string) {
  const form = new FormData();
  const bytes = await readFile(filePath);
  form.append("jobId", job.id);
  form.append("attemptNumber", String(attemptNumber));
  form.append("file", new Blob([bytes], { type: "image/png" }), path.basename(filePath));
  const response = await api("/api/rnd/worker/artifacts", { method: "POST", body: form });
  if (!response.ok) throw new Error(`Artifact upload failed: HTTP ${response.status} ${await response.text()}`);
  const body = await response.json() as { ok: boolean; asset?: { id: string } };
  if (!body.asset?.id) throw new Error("Artifact upload returned no asset id.");
  return body.asset.id;
}

async function firstVisible(locators: Locator[]) {
  for (const locator of locators) {
    try {
      for (let index = await locator.count() - 1; index >= 0; index--) {
        const candidate = locator.nth(index);
        if (await candidate.isVisible()) return candidate;
      }
    } catch { /* try next selector */ }
  }
  throw new Error("Required Gemini control was not found.");
}

async function waitForComposer(page: Page) {
  return firstVisible([
    page.locator("textarea"),
    page.locator('[contenteditable="true"][role="textbox"]'),
    page.locator('[contenteditable="true"]'),
  ]);
}

async function ensureSignedIn(page: Page) {
  await page.goto(GEMINI_URL, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(1_500);
  const signIn = page.getByRole("link", { name: /sign in/i }).or(page.getByRole("button", { name: /sign in/i }));
  if (await signIn.count() && await signIn.first().isVisible().catch(() => false)) {
    console.log("Gemini requires sign-in. Complete Google/Gemini sign-in in the visible Chrome window.");
    await page.waitForFunction(() => Boolean(document.querySelector('textarea,[contenteditable="true"]')), { timeout: 600_000, polling: 1_000 });
  }
}

async function openImagesMode(page: Page) {
  try {
    const entry = await firstVisible([
      page.getByRole("link", { name: /^Images$/i }),
      page.getByRole("button", { name: /^Images$/i }),
      page.getByText("Images", { exact: true }),
    ]);
    await entry.click();
    await page.waitForTimeout(1_500);
  } catch { /* current composer may already be image mode */ }

  const discovery = page.locator('[data-test-id="image-creation-discovery-card"]');
  if (await discovery.count() && await discovery.first().isVisible().catch(() => false)) {
    try { await discovery.first().click({ force: true, timeout: 5_000 }); }
    catch { await discovery.first().evaluate((el) => (el as HTMLElement).click()); }
    await page.waitForTimeout(1_500);
    return;
  }

  const createImages = page.getByText("Create images", { exact: true });
  if (await createImages.count() && await createImages.first().isVisible().catch(() => false)) {
    try { await createImages.first().click({ force: true, timeout: 5_000 }); }
    catch { await createImages.first().evaluate((el) => (el.parentElement?.parentElement as HTMLElement | null)?.click()); }
    await page.waitForTimeout(1_500);
  }
}

async function uploadReference(page: Page, filePath: string) {
  const directInput = page.locator('input[type="file"]');
  if (await directInput.count()) {
    await directInput.first().setInputFiles(filePath);
    return;
  }

  const attach = await firstVisible([
    page.getByRole("button", { name: /open upload file menu|add files|attach files|upload files/i }),
    page.locator('button[aria-label*="Upload" i]'),
    page.locator('button[aria-label*="Attach" i]'),
  ]);
  const chooser = page.waitForEvent("filechooser", { timeout: 10_000 }).catch(() => null);
  await attach.click();
  const event = await chooser;
  if (event) {
    await event.setFiles(filePath);
    return;
  }
  const fallback = page.locator('input[type="file"]');
  if (await fallback.count()) {
    await fallback.first().setInputFiles(filePath);
    return;
  }
  throw new Error("Gemini upload control unavailable.");
}

async function submitPrompt(page: Page, prompt: string) {
  const composer = await waitForComposer(page);
  await composer.fill(prompt);
  for (const locator of [
    page.getByRole("button", { name: /send|submit/i }),
    page.locator('button[aria-label*="Send" i]'),
  ]) {
    try {
      const button = await firstVisible([locator]);
      await button.click();
      return;
    } catch { /* fallback */ }
  }
  await composer.press("Enter");
}

async function largeImages(page: Page) {
  return await page.evaluate(() => Array.from(document.images)
    .map((image) => ({ src: image.currentSrc || image.src, area: image.naturalWidth * image.naturalHeight }))
    .filter((image) => image.src && image.area >= 512 * 512)
    .sort((a, b) => b.area - a.area)
    .map((image) => image.src));
}

async function waitForGeneratedImage(page: Page, before: Set<string>) {
  const deadline = Date.now() + GENERATION_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const current = await largeImages(page);
    const generated = current.find((src) => !before.has(src));
    if (generated) return generated;
    await page.waitForTimeout(1_000);
  }
  throw new Error("Timed out waiting for Gemini generated image.");
}

async function captureGeneratedImage(page: Page, source: string, outputPath: string) {
  if (source.startsWith("data:")) {
    const encoded = source.split(",", 2)[1];
    if (!encoded) throw new Error("Invalid data image.");
    await writeFile(outputPath, Buffer.from(encoded, "base64"));
    return;
  }

  if (source.startsWith("blob:")) {
    try {
      const encoded = await page.evaluate(async (url) => {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Blob fetch failed: ${response.status}`);
        const blob = await response.blob();
        return await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const value = String(reader.result);
            const comma = value.indexOf(",");
            comma < 0 ? reject(new Error("Invalid blob data")) : resolve(value.slice(comma + 1));
          };
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(blob);
        });
      }, source);
      await writeFile(outputPath, Buffer.from(encoded, "base64"));
      return;
    } catch { /* element screenshot fallback below */ }
  }

  if (source.startsWith("http")) {
    const response = await page.request.get(source);
    if (response.ok()) {
      await writeFile(outputPath, await response.body());
      return;
    }
  }

  const index = await page.locator("img").evaluateAll((images, target) => images.findIndex((image) => {
    const element = image as HTMLImageElement;
    return (element.currentSrc || element.src) === target;
  }), source);
  if (index < 0) throw new Error("Generated image element not found.");
  const image = page.locator("img").nth(index);
  await image.scrollIntoViewIfNeeded();
  await image.screenshot({ path: outputPath });
}

async function processJob(page: Page, job: ClaimedJob) {
  const attemptNumber = job.attemptNumber;
  const sourcePath = await downloadSource(job.sourceAsset, job.id);
  const generationStartedAt = new Date().toISOString();
  const heartbeatTimer = setInterval(() => {
    void heartbeat(job.id).catch((error) => console.error(`Heartbeat error: ${error instanceof Error ? error.message : String(error)}`));
  }, LEASE_HEARTBEAT_MS);

  try {
    await ensureSignedIn(page);
    await page.goto(GEMINI_URL, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForTimeout(1_000);
    await openImagesMode(page);
    await uploadReference(page, sourcePath);
    const before = new Set(await largeImages(page));
    if (!job.currentPrompt) throw new Error("Claimed job has no current prompt.");

    console.log(`Job ${job.id}: submitting attempt ${attemptNumber}.`);
    await submitPrompt(page, job.currentPrompt);
    const generatedSource = await waitForGeneratedImage(page, before);
    const outputPath = path.join(OUTPUT_DIR, `${job.id}-attempt-${attemptNumber}.png`);
    await captureGeneratedImage(page, generatedSource, outputPath);
    const artifactId = await uploadArtifact(job, attemptNumber, outputPath);

    await report(job, attemptNumber, {
      submittedAt: generationStartedAt,
      generationStartedAt,
      generationCompletedAt: new Date().toISOString(),
      artifactId,
    });
    console.log(`Job ${job.id}: attempt ${attemptNumber} uploaded and reported for QA.`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Job ${job.id}: ${message}`);
    await report(job, attemptNumber, {
      submittedAt: generationStartedAt,
      generationStartedAt,
      generationCompletedAt: null,
      errorCode: "WORKER_EXECUTION_ERROR",
      errorMessage: message.slice(0, 2000),
    });
  } finally {
    clearInterval(heartbeatTimer);
  }
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });
  console.log(`DMH R&D worker ${await workerId()} starting.`);
  console.log(`API: ${API_BASE}`);
  await assertServer();

  const context: BrowserContext = await chromium.launchPersistentContext(PROFILE_DIR, {
    executablePath: CHROME_PATH,
    headless: false,
    acceptDownloads: true,
    viewport: { width: 1440, height: 1000 },
  });
  const page = context.pages()[0] ?? await context.newPage();

  process.on("SIGINT", async () => {
    console.log("Stopping worker; closing Chrome.");
    await context.close();
    process.exit(0);
  });

  while (true) {
    const result = await claim();
    if (!result.job) {
      await new Promise((resolve) => setTimeout(resolve, POLL_MS));
      continue;
    }
    console.log(`Claimed job ${result.job.id} (attempt ${result.job.attemptNumber}).`);
    await processJob(page, result.job);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
