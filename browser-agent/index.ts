import { defineFn } from "@browserbasehq/sdk-functions";
import { chromium } from "playwright-core";

type AgentParams = {
  mode?: "calibrate" | "generate";
  jobId?: string;
  contextId?: string;
};

const APP_URL = required("RND_APP_URL").replace(/\\/$/, "");
const WORKER_TOKEN = required("RND_WORKER_TOKEN");
const WORKER_ID = required("RND_WORKER_ID");

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(name + " is required");
  return value;
}

async function rndFetch(path: string, init: RequestInit = {}) {
  const response = await fetch(APP_URL + path, {
    ...init,
    headers: {
      authorization: "Bearer " + WORKER_TOKEN,
      "x-rnd-worker-id": WORKER_ID,
      ...(init.headers || {}),
    },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      typeof data?.error === "string" ? data.error : "R&D control-plane request failed"
    );
  }
  return data;
}

async function getSource(jobId: string): Promise<Buffer> {
  const response = await fetch(
    APP_URL + "/api/rnd/agent/source?jobId=" + encodeURIComponent(jobId),
    {
      headers: {
        authorization: "Bearer " + WORKER_TOKEN,
        "x-rnd-worker-id": WORKER_ID,
      },
      cache: "no-store",
    }
  );
  if (!response.ok) {
    throw new Error("R&D source download failed with HTTP " + response.status);
  }
  return Buffer.from(await response.arrayBuffer());
}

async function heartbeat(jobId: string): Promise<void> {
  await rndFetch("/api/rnd/agent/heartbeat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jobId }),
  });
}

async function uploadArtifact(jobId: string, attemptNumber: number, bytes: Buffer): Promise<string> {
  const form = new FormData();
  form.append("jobId", jobId);
  form.append("attemptNumber", String(attemptNumber));
  form.append("image", new Blob([bytes], { type: "image/png" }), "gemini-result.png");

  const result = await rndFetch("/api/rnd/agent/artifact", {
    method: "POST",
    body: form,
  });
}

async function reportFailure(jobId: string, attemptNumber: number, error: unknown): Promise<void> {
  await rndFetch("/api/rnd/worker/report", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jobId,
      attemptNumber,
      generationStartedAt: new Date().toISOString(),
      errorCode: "BROWSER_AGENT_ERROR",
      errorMessage: error instanceof Error ? error.message : "Browser agent failed.",
    }),
  }).catch(() => {});
}

async function describeGeminiUi(page: any) {
  return page.evaluate(() => ({
    url: location.href,
    title: document.title,
    textareas: Array.from(document.querySelectorAll("textarea")).map((el: HTMLTextAreaElement) => ({
      ariaLabel: el.getAttribute("aria-label"),
      placeholder: el.getAttribute("placeholder"),
      visible: !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length),
    })),
    fileInputs: Array.from(document.querySelectorAll('input[type="file"]')).map((el: HTMLInputElement) => ({
      accept: el.accept,
      multiple: el.multiple,
    })),
    buttons: Array.from(document.querySelectorAll("button")).slice(0, 80).map((el: HTMLButtonElement) => ({
      text: (el.innerText || "").trim().slice(0, 120),
      ariaLabel: el.getAttribute("aria-label"),
      title: el.getAttribute("title"),
      disabled: el.disabled,
    })),
  }));
}

async function findPromptBox(page: any) {
  const candidates = [
    page.locator("textarea").first(),
    page.getByRole("textbox").first(),
  ];

  for (const locator of candidates) {
    try {
      await locator.waitFor({ state: "visible", timeout: 5000 });
      return locator;
    } catch {}
  }

  throw new Error("Gemini prompt textbox was not found.");
}

async function findFileInput(page: any) {
  const direct = page.locator('input[type="file"]').first();
  try {
    await direct.waitFor({ state: "attached", timeout: 5000 });
    return direct;
  } catch {}

  throw new Error(
    "Gemini file input was not found. Supervised UI calibration is required; no upload bypass is attempted."
  );
}

async function captureImageElement(page: any): Promise<Buffer> {
  const images = page.locator("img");
  const count = await images.count();

  for (let i = count - 1; i >= 0; i--) {
    const img = images.nth(i);
    const src = await img.getAttribute("src");
    if (!src || (!src.startsWith("blob:") && !src.startsWith("data:image/") && !src.startsWith("https://"))) {
      continue;
    }

    const box = await img.boundingBox().catch(() => null);
    if (!box || box.width < 200 || box.height < 200) continue;

    if (src.startsWith("data:image/")) {
      const base64 = src.split(",", 2)[1];
      return Buffer.from(base64, "base64");
    }

    const result = await page.evaluate(async (url: string) => {
      const response = await fetch(url);
      const blob = await response.blob();
      const buffer = await blob.arrayBuffer();
      return {
        type: blob.type || "image/png",
        base64: Array.from(new Uint8Array(buffer))
          .map((byte) => String.fromCharCode(byte))
          .join(""),
      };
    }, src).catch(() => null);

    if (result?.base64) {
      return Buffer.from(result.base64, "binary");
    }

    return Buffer.from(await img.screenshot({ type: "png" }));
  }

  throw new Error("No generated image was detected in the Gemini UI.");
}

async function runCalibration(page: any) {
  await page.goto("https://gemini.google.com/", {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});

  const ui = await describeGeminiUi(page);
  console.log("GEMINI_UI_CALIBRATION", JSON.stringify(ui));

  // Calibration is deliberately read-only. It must never submit a prompt or
  // upload an R&D source until the visible Gemini UI has been verified.
  return {
    mode: "calibrate",
    readyForSupervisedCalibration: true,
    ui,
  };
}

async function runGeneration(page: any, job: {
  id: string;
  attemptNumber: number;
  prompt: string;
}): Promise<{ artifactBytes: Buffer }> {
  await page.goto("https://gemini.google.com/", {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});

  const source = await getSource(job.id);
  const sourceFile = { name: "rnd-source.jpg", mimeType: "image/jpeg", buffer: source };

  const fileInput = await findFileInput(page);
  await fileInput.setInputFiles(sourceFile);

  const promptBox = await findPromptBox(page);
  await promptBox.fill(job.prompt);

  // The generate/send control is intentionally NOT guessed. A supervised
  // calibration must lock its accessible name before unattended generation.
  throw new Error(
    "GENERATION_STOP: Gemini generate/send control is not yet calibrated. No submission was made."
  );
}

defineFn("draftmyhair-rnd-browser-agent", async (context, params?: AgentParams) => {
  const mode = params?.mode || "calibrate";
  const page = await chromium
    .connectOverCDP(context.session.connectUrl)
    .then((browser) => {
      const browserContext = browser.contexts()[0];
      return browserContext.pages()[0] || browserContext.newPage();
    });

  try {
    if (mode === "calibrate") {
      return await runCalibration(page);
    }

    const claimed = params?.jobId
      ? { job: params.jobId }
      : await rndFetch("/api/rnd/agent/claim", { method: "POST" });

    const job = typeof claimed.job === "object" ? claimed.job : null;
    if (!job) return { ok: true, message: "No R&D job is ready." };

    await heartbeat(job.id);

    try {
      const result = await runGeneration(page, job);
      await uploadArtifact(job.id, job.attemptNumber, result.artifactBytes);
      await rndFetch("/api/rnd/worker/report", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jobId: job.id,
          attemptNumber: job.attemptNumber,
          generationStartedAt: new Date().toISOString(),
          generationCompletedAt: new Date().toISOString(),
          artifactId,
        }),
      });
      return { ok: true, jobId: job.id, attemptNumber: job.attemptNumber };
    } catch (error) {
      await reportFailure(job.id, job.attemptNumber, error);
      throw error;
    }
  } finally {
    await page.close().catch(() => {});
  }
});
