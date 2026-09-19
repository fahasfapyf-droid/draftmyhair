import { chromium, type BrowserContext, type Page } from "playwright";
import { assertReady, captureGeneratedImage, freshChat, largeImages, openImageGenerationMode, openGemini, submitPrompt, uploadReference, waitForGeneratedImage } from "./gemini-page.js";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const API_BASE = (process.env.RND_API_BASE_URL ?? "https://draftmyhair-git-rnd-prompt-lab-v3-draftmyhair.vercel.app").replace(/\/$/, "");
const WORKER_TOKEN = process.env.RND_WORKER_TOKEN?.trim();
const WORKER_DIR = path.dirname(fileURLToPath(import.meta.url));
const WORKER_ID_FILE = process.env.RND_WORKER_ID_FILE ?? path.resolve(WORKER_DIR, ".rnd-worker-id");
const REPO_ROOT = path.resolve(WORKER_DIR, "../..");
const PROFILE_DIR = path.resolve(REPO_ROOT, "tools", "gemini-web-agent", "chrome-profile");
const OUTPUT_DIR = process.env.DMH_RND_OUTPUT_DIR
  ? (path.isAbsolute(process.env.DMH_RND_OUTPUT_DIR) ? process.env.DMH_RND_OUTPUT_DIR : path.resolve(REPO_ROOT, process.env.DMH_RND_OUTPUT_DIR))
  : path.resolve(WORKER_DIR, "output");
const CHROME_PATH = process.env.CHROME_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
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
  attemptCount: number;
  attemptNumber: number;
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
  console.log("Polling R&D claim endpoint...");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  let response: Response;
  try {
    response = await api("/api/rnd/worker/claim", { method: "POST", signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
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
  const mimeType = filePath.toLowerCase().endsWith(".jpg") || filePath.toLowerCase().endsWith(".jpeg")
    ? "image/jpeg"
    : filePath.toLowerCase().endsWith(".webp")
      ? "image/webp"
      : "image/png";
  form.append("file", new Blob([bytes], { type: mimeType }), path.basename(filePath));
  const response = await api("/api/rnd/worker/artifacts", { method: "POST", body: form });
  if (!response.ok) throw new Error(`Artifact upload failed: HTTP ${response.status} ${await response.text()}`);
  const body = await response.json() as { ok: boolean; asset?: { id: string } };
  if (!body.asset?.id) throw new Error("Artifact upload returned no asset id.");
  return body.asset.id;
}

async function processJob(page: Page, job: ClaimedJob) {
  const attemptNumber = job.attemptNumber;
  const sourcePath = await downloadSource(job.sourceAsset, job.id);
  const generationStartedAt = new Date().toISOString();
  const heartbeatTimer = setInterval(() => {
    void heartbeat(job.id).catch((error) => console.error(`Heartbeat error: ${error instanceof Error ? error.message : String(error)}`));
  }, LEASE_HEARTBEAT_MS);

  try {
    await openGemini(page);
    await assertReady(page);
    await freshChat(page);
    await openImageGenerationMode(page);
    await uploadReference(page, sourcePath);
    const before = new Set(await largeImages(page));
    if (!job.currentPrompt) throw new Error("Claimed job has no current prompt.");

    console.log(`Job ${job.id}: submitting attempt ${attemptNumber}.`);
    await submitPrompt(page, job.currentPrompt);
    await waitForGeneratedImage(page, before);
    const outputPath = path.join(OUTPUT_DIR, `${job.id}-attempt-${attemptNumber}.png`);
    await captureGeneratedImage(page, outputPath, before);
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

  console.log(`Launching Chrome with persistent Gemini profile: ${PROFILE_DIR}`);
  console.log(`Chrome executable: ${CHROME_PATH}`);
  console.log("Starting Playwright persistent-context launch (30s diagnostic timeout)...");
  const launchStartedAt = Date.now();
  let context: BrowserContext;
  try {
    context = await chromium.launchPersistentContext(PROFILE_DIR, {
      executablePath: CHROME_PATH,
      headless: false,
      acceptDownloads: true,
      viewport: { width: 1440, height: 1000 },
      timeout: 30_000,
    });
  } catch (error) {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    console.error(`Chrome persistent-context launch failed after ${Date.now() - launchStartedAt}ms:`);
    console.error(message);
    throw error;
  }
  console.log(`Chrome persistent context launched in ${Date.now() - launchStartedAt}ms.`);
  console.log(`Chrome context currently has ${context.pages().length} page(s).`);
  console.log("Creating/selecting worker page...");
  const page = context.pages()[0] ?? await context.newPage({ timeout: 30_000 });
  console.log("Worker page ready.");

  process.on("SIGINT", async () => {
    console.log("Stopping worker; closing Chrome.");
    await context.close();
    process.exit(0);
  });

  while (true) {
    const result = await claim();
    if (!result.job) {
      console.log("No queued R&D job available; waiting 10s.");
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
