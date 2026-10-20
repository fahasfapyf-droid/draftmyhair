import { chromium, type BrowserContext, type Page } from "playwright";
import { assertReady, captureGeneratedImage, freshChat, largeImages, openImageGenerationMode, openGemini, submitPrompt, uploadReference, waitForGeneratedImage } from "./gemini-page.js";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { classifyProfileError, getGeminiProfileStatusSnapshot, markGenerationStarted, markProfileExhausted, markProfileRestricted, selectGeminiProfile, type GeminiProfile } from "./profile-manager.js";

const API_BASE = (process.env.RND_API_BASE_URL?.trim() || "https://draftmyhair-git-rnd-qa-gate-clean-integration-draftmyhair.vercel.app").replace(/\/$/, "");
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
const GENERATION_TIMEOUT_MS = 300_000;
const STATUS_HEARTBEAT_MS = 15_000;
const RUN_ONCE = /^(1|true|yes)$/i.test(process.env.RND_WORKER_ONCE ?? "");
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
  claimGeneration: string;
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
      signal: AbortSignal.timeout(10_000),
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
  const result = await response.json() as ClaimResponse;
  if (result.job && !isClaimGeneration(result.job.claimGeneration)) {
    throw new Error("Claim response did not include a valid claim generation.");
  }
  return result;
}

function isClaimGeneration(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const generation = new Date(value);
  return !Number.isNaN(generation.getTime()) && generation.toISOString() === value;
}

async function heartbeat(job: ClaimedJob) {
  const response = await api("/api/rnd/worker/heartbeat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    signal: AbortSignal.timeout(10_000),
    body: JSON.stringify({ jobId: job.id, claimGeneration: job.claimGeneration }),
  });
  if (!response.ok) throw new Error(`Heartbeat failed: HTTP ${response.status} ${await response.text()}`);
}

const REPORT_TIMEOUT_MS = 270_000;

async function report(job: ClaimedJob, attemptNumber: number, payload: Record<string, unknown>) {
  const response = await api("/api/rnd/worker/report", {
    method: "POST",
    headers: { "content-type": "application/json" },
    signal: AbortSignal.timeout(REPORT_TIMEOUT_MS),
    body: JSON.stringify({
      jobId: job.id,
      attemptNumber,
      prompt: job.currentPrompt,
      promptRevision: promptRevision(job.currentPrompt ?? ""),
      ...payload,
      claimGeneration: job.claimGeneration,
    }),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Report failed: HTTP ${response.status} ${body}`);
  }
  const result = await response.json();
  console.log(`R&D report response for ${job.id} attempt ${attemptNumber}: ${JSON.stringify(result)}`);
  return result;
}

async function reportWithRetry(job: ClaimedJob, attemptNumber: number, payload: Record<string, unknown>) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await report(job, attemptNumber, payload);
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      // Authentication and lease conflicts are definitive; retrying could obscure a stale claim.
      if (/HTTP (?:401|409)\b/i.test(message) || attempt === 3) break;
      const delayMs = attempt === 1 ? 5_000 : 15_000;
      console.error(`Report handoff attempt ${attempt}/3 failed for job ${job.id}; retrying same attempt/artifact in ${delayMs / 1000}s: ${message}`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError ?? "Report handoff failed."));
}

async function release(job: ClaimedJob) {
  const response = await api("/api/rnd/worker/release", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jobId: job.id, claimGeneration: job.claimGeneration }),
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
  form.append("claimGeneration", job.claimGeneration);
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
  let generationStartedAt: string | null = null;
  let uploadedArtifactId: string | null = null;
  let sourceDownloaded = false;
  let heartbeatInFlight: Promise<void> | null = null;
  const heartbeatTimer = setInterval(() => {
    if (heartbeatInFlight) return;
    heartbeatInFlight = heartbeat(job)
      .catch((error) => console.error(`Heartbeat error: ${error instanceof Error ? error.message : String(error)}`))
      .finally(() => { heartbeatInFlight = null; });
  }, LEASE_HEARTBEAT_MS);

  try {
    const sourcePath = await downloadSource(job.sourceAsset, job.id);
    sourceDownloaded = true;
    generationStartedAt = new Date().toISOString();
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
    uploadedArtifactId = artifactId;

    await reportWithRetry(job, attemptNumber, {
      submittedAt: generationStartedAt,
      generationStartedAt,
      generationCompletedAt: new Date().toISOString(),
      artifactId,
    });
    console.log(`Job ${job.id}: attempt ${attemptNumber} uploaded and reported for QA.`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Job ${job.id}: ${message}`);

    // An uploaded artifact proves generation completed. Do not relabel it as a generation failure.
    if (uploadedArtifactId) {
      captureStatus = "PASS";
      captureLastError = `Artifact ${uploadedArtifactId} uploaded; report/QA handoff failed: ${message}`.slice(0, 2000);
      console.error(`Job ${job.id}: artifact ${uploadedArtifactId} is retained; stopping for lease recovery/reconciliation.`);
      return "STOP";
    }

    if (!sourceDownloaded) {
      captureStatus = "FAIL";
      captureLastError = `Source download failed before generation: ${message}`.slice(0, 2000);
      console.error(`Job ${job.id}: source download failed before generation; releasing the unconsumed attempt.`);
      await release(job).catch((releaseError) => console.error(`Could not release job after source download failure; its lease will expire: ${releaseError instanceof Error ? releaseError.message : String(releaseError)}`));
      return "STOP";
    }

    captureStatus = "FAIL";
    captureLastError = message.slice(0, 2000);
    const profileError = classifyProfileError(message);

    // Record local profile state before the network report so report outages do not block rotation.
    if (profileError === "EXHAUSTED") {
      await markProfileExhausted(profile.id, message);
      console.error(`Gemini profile ${profile.id} marked EXHAUSTED; worker will rotate.`);
    } else if (profileError === "RESTRICTED") {
      await markProfileRestricted(profile.id, message);
      console.error(`Gemini profile ${profile.id} marked RESTRICTED; operator review is required.`);
    }

    try {
      await reportWithRetry(job, attemptNumber, {
        submittedAt: generationStartedAt ?? new Date().toISOString(),
        generationStartedAt,
        generationCompletedAt: null,
        errorCode: profileError === "EXHAUSTED" ? "GEMINI_PROFILE_EXHAUSTED" : "WORKER_EXECUTION_ERROR",
        errorMessage: message.slice(0, 2000),
      });
    } catch (reportError) {
      console.error(`Job ${job.id}: failure report could not be delivered; lease recovery may be required: ${reportError instanceof Error ? reportError.message : String(reportError)}`);
      return "STOP";
    }

    if (profileError === "EXHAUSTED") return "ROTATE";
    if (profileError === "RESTRICTED") return "STOP";
  } finally {
    clearInterval(heartbeatTimer);
    if (heartbeatInFlight) await heartbeatInFlight;
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
  try {
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
    const page = await context.newPage();
    page.on("close", () => console.error("DIAGNOSTIC: Worker Playwright page emitted close."));
    page.on("crash", () => console.error("DIAGNOSTIC: Worker Playwright page crashed."));
    page.on("pageerror", (error) => console.error(`DIAGNOSTIC: Worker Playwright page error: ${error.message}`));
    console.log(`Worker page ready on Gemini profile ${profile.id}.`);
    return { context, page };
  } catch (error) {
    try {
      await context.close();
    } catch (cleanupError) {
      try {
        console.error(`Browser context cleanup after session setup failure also failed: ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`);
      } catch {
        // Preserve the original session setup error if cleanup logging also fails.
      }
    }
    throw error;
  }
}

async function main() {
  let statusTimer: ReturnType<typeof setInterval> | null = null;
  let context: BrowserContext | null = null;
  let shutdownRequested = false;
  let statusUpdates = Promise.resolve();
  const onSigint = () => {
    shutdownRequested = true;
    console.log("Stopping worker after the current operation; cleanup will run before exit.");
  };
  const updateWorkerStatus = (workerState: "ONLINE" | "STOPPED" = "ONLINE") => {
    const update = statusUpdates.then(() => reportWorkerStatus(workerState));
    statusUpdates = update;
    return update;
  };
  const closeContextSafely = async () => {
    const activeContext = context;
    context = null;
    if (!activeContext) return;
    try {
      await activeContext.close();
    } catch (error) {
      console.error(`Browser context close failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  };
  const stopWorker = async () => {
    if (statusTimer) clearInterval(statusTimer);
    statusTimer = null;
    try {
      await statusUpdates;
    } catch (error) {
      console.error(`Pending worker status update failed during shutdown: ${error instanceof Error ? error.message : String(error)}`);
    }
    try {
      await reportWorkerStatus("STOPPED");
    } catch (error) {
      console.error(`Worker STOPPED status cleanup failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    await closeContextSafely();
  };

  process.on("SIGINT", onSigint);
  try {
    await mkdir(OUTPUT_DIR, { recursive: true });
    console.log(`DMH R&D worker ${await workerId()} starting.`);
    console.log(`API: ${API_BASE}`);
    await assertServer();

    let geminiProfile = await selectGeminiProfile();
    geminiProfileForStatus = geminiProfile;
    console.log(`Selected Gemini profile: ${geminiProfile.id} (${geminiProfile.label})`);
    await updateWorkerStatus();
    statusTimer = setInterval(() => void updateWorkerStatus(), STATUS_HEARTBEAT_MS);
    if (shutdownRequested) return;

    let session = await launchGeminiSession(geminiProfile);
    context = session.context;
    let page = session.page;

    while (!shutdownRequested) {
      // Re-evaluate eligibility before leasing a job so profile cooldowns,
      // minimum intervals, hourly caps, and restriction state apply continuously.
      if (!RUN_ONCE) {
        try {
          const eligibleProfile = await selectGeminiProfile();
          if (eligibleProfile.id !== geminiProfile.id) {
            await closeContextSafely();
            geminiProfile = eligibleProfile;
            geminiProfileForStatus = geminiProfile;
            console.log(`Switching to eligible Gemini profile before claiming work: ${geminiProfile.id} (${geminiProfile.label})`);
            await updateWorkerStatus();
            session = await launchGeminiSession(geminiProfile);
            context = session.context;
            page = session.page;
          }
        } catch (error) {
          console.error(`No Gemini profile is currently eligible; no job will be claimed: ${error instanceof Error ? error.message : String(error)}`);
          if (shutdownRequested) break;
          await new Promise((resolve) => setTimeout(resolve, POLL_MS));
          continue;
        }
      }

      const result = await claim();
      if (!result.job) {
        if (RUN_ONCE) {
          console.log("RND_WORKER_ONCE enabled; no eligible job was claimed, so the worker is exiting without waiting.");
          return;
        }
        console.log("No queued R&D job available; waiting 10s.");
        await new Promise((resolve) => setTimeout(resolve, POLL_MS));
        continue;
      }
      if (shutdownRequested) {
        await release(result.job).catch((error) => console.error(`Could not release claimed job during shutdown; its lease will expire: ${error instanceof Error ? error.message : String(error)}`));
        break;
      }
      console.log(`Claimed job ${result.job.id} (attempt ${result.job.attemptNumber}).`);
      if (page.isClosed()) {
        await closeContextSafely();
        try {
          session = await launchGeminiSession(geminiProfile);
          context = session.context;
          page = session.page;
        } catch (error) {
          await release(result.job).catch((releaseError) => console.error(`Could not release job after browser relaunch failure; its lease will expire: ${releaseError instanceof Error ? releaseError.message : String(releaseError)}`));
          throw error;
        }
      }
      const action = await processJob(page, result.job, geminiProfile);
      if (RUN_ONCE) {
        console.log("RND_WORKER_ONCE enabled; the one-shot run is finished and will not claim another job.");
        return;
      }
      if (action === "STOP") {
        console.error("R&D worker stopped safely after a non-recoverable execution or handoff error. Check the preceding log; no automatic restriction bypass was attempted.");
        return;
      }
      if (action === "ROTATE") {
        await closeContextSafely();
        while (!shutdownRequested) {
          try {
            geminiProfile = await selectGeminiProfile();
            geminiProfileForStatus = geminiProfile;
            console.log(`Rotating to eligible Gemini profile: ${geminiProfile.id} (${geminiProfile.label})`);
            await updateWorkerStatus();
            session = await launchGeminiSession(geminiProfile);
            context = session.context;
            page = session.page;
            break;
          } catch (error) {
            console.error(`No alternate Gemini profile is currently eligible: ${error instanceof Error ? error.message : String(error)}`);
            if (shutdownRequested) break;
            await new Promise((resolve) => setTimeout(resolve, POLL_MS));
          }
        }
      }
    }
  } finally {
    process.off("SIGINT", onSigint);
    await stopWorker();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
