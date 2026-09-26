import { chromium, type BrowserContext, type Page } from "playwright";
import { assertReady, captureGeneratedImage, freshChat, largeImages, openImageGenerationMode, openGemini, submitPrompt, uploadReference, waitForGeneratedImage } from "./gemini-page.js";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { classifyProfileError, getGeminiProfileStatusSnapshot, markGenerationStarted, markProfileExhausted, markProfileRestricted, selectGeminiProfile, type GeminiProfile } from "./profile-manager.js";

const API_BASE = (process.env.RND_API_BASE_URL ?? "https://draftmyhair-git-rnd-local-gemini-worker-v1-draftmyhair.vercel.app").replace(/\/$/, "");
const WORKER_TOKEN = process.env.RND_WORKER_TOKEN?.trim();
const WORKER_DIR = path.dirname(fileURLToPath(import.meta.url));
const WORKER_ID_FILE = process.env.RND_WORKER_ID_FILE ?? path.resolve(WORKER_DIR, ".rnd-worker-id");
const REPO_ROOT = path.resolve(WORKER_DIR, "../..");
const OUTPUT_DIR = process.env.DMH_RND_OUTPUT_DIR
  ? (path.isAbsolute(process.env.DMH_RND_OUTPUT_DIR) ? process.env.DMH_RND_OUTPUT_DIR : path.resolve(REPO_ROOT, process.env.DMH_RND_OUTPUT_DIR))
  : path.resolve(WORKER_DIR, "output");
const CHROME_PATH = process.env.CHROME_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const POLL_MS = 10_000;
const LEASE_HEARTBEAT_MS = 40_000;
const GENERATION_TIMEOUT_MS = 180_000;
const STATUS_HEARTBEAT_MS = 15_000;
const WORKER_VERSION = process.env.RND_WORKER_VERSION ?? "local-gemini-worker-v1";

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
let captureStatus: "UNKNOWN" | "PASS" | "FAIL" = "UNKNOWN";
let captureLastSuccessAt: string | null = null;
let captureLastError: string | null = null;
let currentJobId: string | null = null;

async function reportWorkerStatus(workerState: "ONLINE" | "STOPPED" = "ONLINE") {
  try {
    const profiles = await getGeminiProfileStatusSnapshot();
    const response = await api("/api/rnd/worker/status", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        workerVersion: WORKER_VERSION,
        protocolVersion: "1",
        workerState,
        activeProfileId: geminiProfileForStatus?.id ?? null,
        activeProfileLabel: geminiProfileForStatus?.label ?? null,
        currentJobId,
        captureStatus,
        captureLastSuccessAt,
        captureLastError,
        profileSnapshot: profiles,
      }),
    });
    if (!response.ok) console.error(`Worker status update failed: HTTP ${response.status} ${await response.text()}`);
  } catch (error) {
    console.error(`Worker status update error: ${error instanceof Error ? error.message : String(error)}`);
  }
}

let geminiProfileForStatus: GeminiProfile | null = null;

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
  if (!response.ok) {
    const body = await response.text();
    if (response.status === 409 && body.includes("Maximum autonomous attempts exceeded")) {
      console.error(`R&D report rejected because job ${job.id} is already over the autonomous attempt budget; continuing with the queue.`);
      return null;
    }
    throw new Error(`Report failed: HTTP ${response.status} ${body}`);
  }
  const result = await response.json();
  console.log(`R&D report response for ${job.id} attempt ${attemptNumber}: ${JSON.stringify(result)}`);
  return result;
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

async function processJob(page: Page, job: ClaimedJob, profile: GeminiProfile): Promise<"CONTINUE" | "ROTATE" | "STOP"> {
  currentJobId = job.id;
  captureStatus = "UNKNOWN";
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

    console.log(`Job ${job.id}: submitting attempt ${attemptNumber} using Gemini profile ${profile.id}.`);
    await markGenerationStarted(profile.id);
    await submitPrompt(page, job.currentPrompt);
    const generatedSource = await waitForGeneratedImage(page, before);
    const outputPath = path.join(OUTPUT_DIR, `${job.id}-attempt-${attemptNumber}.png`);
    await captureGeneratedImage(page, outputPath, generatedSource, before);
    captureStatus = "PASS";
    captureLastSuccessAt = new Date().toISOString();
    captureLastError = null;
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
    captureStatus = "FAIL";
    captureLastError = message.slice(0, 2000);
    console.error(`Job ${job.id}: ${message}`);
    await report(job, attemptNumber, {
      submittedAt: generationStartedAt,
      generationStartedAt,
      generationCompletedAt: null,
      errorCode: "WORKER_EXECUTION_ERROR",
      errorMessage: message.slice(0, 2000),
    });
    const profileError = classifyProfileError(message);
    if (profileError === "EXHAUSTED") {
      await markProfileExhausted(profile.id, message);
      console.error(`Gemini profile ${profile.id} marked EXHAUSTED; worker will rotate to another eligible profile.`);
      return "ROTATE";
    }
    if (profileError === "RESTRICTED") {
      await markProfileRestricted(profile.id, message);
      console.error(`Gemini profile ${profile.id} marked RESTRICTED; worker will stop. Explicit operator review is required before another profile is selected.`);
      return "STOP";
    }
  } finally {
    clearInterval(heartbeatTimer);
    currentJobId = null;
    await reportWorkerStatus().catch(() => undefined);
  }
  return "CONTINUE";
}

async function launchGeminiSession(profile: GeminiProfile) {
  console.log(`Launching Chrome with persistent Gemini profile: ${profile.directory}`);
  console.log(`Chrome executable: ${CHROME_PATH}`);
  console.log("Starting Playwright persistent-context launch (30s diagnostic timeout)...");
  const launchStartedAt = Date.now();
  let context: BrowserContext;
  try {
    context = await chromium.launchPersistentContext(profile.directory, {
      executablePath: CHROME_PATH,
      headless: false,
      acceptDownloads: true,
      viewport: { width: 1440, height: 1000 },
      timeout: 30_000,
      args: [
        "--disable-gpu",
        "--disable-gpu-compositing",
        "--disable-backgrounding-occluded-windows",
        "--disable-renderer-backgrounding",
        "--enable-logging=stderr",
        "--v=1",
      ],
    });
  } catch (error) {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    console.error(`Chrome persistent-context launch failed after ${Date.now() - launchStartedAt}ms:`);
    console.error(message);
    throw error;
  }
  console.log(`Chrome persistent context launched in ${Date.now() - launchStartedAt}ms.`);
  console.log(`Chrome context currently has ${context.pages().length} page(s).`);
  context.on("close", () => console.error("DIAGNOSTIC: Playwright BrowserContext emitted close."));
  const browser = context.browser();
  browser?.on("disconnected", () => {
    console.error("DIAGNOSTIC: Playwright Browser emitted disconnected (browser closed or crashed).");
    console.error("DIAGNOSTIC: Chrome was disconnected after Gemini generation; capture could not continue.");
  });
  context.on("weberror", (error) => console.error(`DIAGNOSTIC: BrowserContext web error: ${error.error().message}`));
  for (const existingPage of context.pages()) {
    existingPage.on("close", () => console.error("DIAGNOSTIC: Existing Playwright page emitted close."));
    existingPage.on("crash", () => console.error("DIAGNOSTIC: Existing Playwright page crashed."));
    existingPage.on("pageerror", (error) => console.error(`DIAGNOSTIC: Existing Playwright page error: ${error.message}`));
  }
  console.log("Creating dedicated worker page...");
  const page = await context.newPage({ timeout: 30_000 });
  page.on("close", () => console.error("DIAGNOSTIC: Worker Playwright page emitted close."));
  page.on("crash", () => console.error("DIAGNOSTIC: Worker Playwright page crashed."));
  page.on("pageerror", (error) => console.error(`DIAGNOSTIC: Worker Playwright page error: ${error.message}`));
  console.log(`Worker page ready on Gemini profile ${profile.id}.`);
  return { context, page };
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });
  console.log(`DMH R&D worker ${await workerId()} starting.`);
  console.log(`API: ${API_BASE}`);
  await assertServer();

  let geminiProfile = await selectGeminiProfile();
  geminiProfileForStatus = geminiProfile;
  console.log(`Selected Gemini profile: ${geminiProfile.id} (${geminiProfile.label})`);
  await reportWorkerStatus();
  const statusTimer = setInterval(() => void reportWorkerStatus(), STATUS_HEARTBEAT_MS);
  let { context, page } = await launchGeminiSession(geminiProfile);

  process.on("SIGINT", async () => {
    clearInterval(statusTimer);
    await reportWorkerStatus("STOPPED");
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
    if (page.isClosed()) {
      await context.close().catch(() => undefined);
      ({ context, page } = await launchGeminiSession(geminiProfile));
    }
    const action = await processJob(page, result.job, geminiProfile);
    if (action === "STOP") {
      await context.close().catch(() => undefined);
      console.error("R&D worker stopped because the active Gemini profile was classified as RESTRICTED. No automatic bypass was attempted.");
      return;
    }
    if (action === "ROTATE") {
      await context.close().catch(() => undefined);
      while (true) {
        try {
          geminiProfile = await selectGeminiProfile();
          geminiProfileForStatus = geminiProfile;
          console.log(`Rotating to eligible Gemini profile: ${geminiProfile.id} (${geminiProfile.label})`);
          await reportWorkerStatus();
          ({ context, page } = await launchGeminiSession(geminiProfile));
          break;
        } catch (error) {
          console.error(`No alternate Gemini profile is currently eligible: ${error instanceof Error ? error.message : String(error)}`);
          await new Promise((resolve) => setTimeout(resolve, POLL_MS));
        }
      }
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
