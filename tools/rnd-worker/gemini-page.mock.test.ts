import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { transformSync } from "esbuild";
import { chromium, type Page } from "playwright";
import { GeminiModelSelectionError, selectGemini31Pro, verifyGemini31Pro } from "./gemini-page";

type Model = "3.1 Pro" | "Flash";
type Fixture = {
  initial?: Model;
  clickOutcome?: Model;
  markSelected?: boolean;
  missing?: boolean;
  noPicker?: boolean;
  keepOpen?: boolean;
  conflicting?: boolean;
  description?: boolean;
};

async function mount(page: Page, fixture: Fixture = {}) {
  await page.setContent("<main></main>");
  await page.evaluate((config) => {
    let current = config.initial ?? "Flash";
    let open = false;
    const root = document.querySelector("main")!;
    document.body.dataset.clicks = "0";
    document.body.dataset.opens = "0";
    // Keep the serialized browser callback free of tsx function-name helpers.
    const render = (() => () => {
      // Replace every node, including the picker, on selection and on open/close.
      root.replaceChildren();
      if (config.noPicker) return;
      const picker = document.createElement("button");
      picker.textContent = current === "3.1 Pro" ? "Pro" : "Flash";
      picker.setAttribute("aria-label", "Open mode picker, currently " + picker.textContent);
      picker.onclick = () => {
        open = !open;
        if (open) document.body.dataset.opens = String(Number(document.body.dataset.opens) + 1);
        render();
      };
      root.append(picker);
      if (!open) return;

      const menu = document.createElement("gem-menu");
      menu.setAttribute("role", "menu");
      const names = config.missing ? ["Flash", "3.1 Pro Preview", "3x1 Pro"] : ["Flash", "3.1 Pro"];
      for (const name of names) {
        const row = document.createElement("gem-menu-item");
        row.setAttribute("role", config.description ? "menuitem" : "menuitemradio");
        row.tabIndex = 0;
        const title = document.createElement("span");
        title.textContent = name;
        row.append(title);
        if (config.description) row.append(document.createTextNode(" For more complex tasks"));
        if (config.markSelected !== false && document.body.dataset.revoke !== "true") {
          row.setAttribute(config.description ? "aria-selected" : "aria-checked",
            String(current === name || Boolean(config.conflicting)));
        }
        row.onclick = () => {
          document.body.dataset.clicks = String(Number(document.body.dataset.clicks) + 1);
          current = config.clickOutcome ?? "3.1 Pro";
          open = config.keepOpen ?? false;
          render();
        };
        menu.append(row);
      }
      root.append(menu);
    })();
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && open) {
        open = false;
        render();
      }
    });
    render();
  }, fixture);
}

async function counters(page: Page) {
  return page.evaluate(() => ({
    clicks: Number(document.body.dataset.clicks),
    opens: Number(document.body.dataset.opens),
    menuVisible: Boolean(document.querySelector("gem-menu")),
  }));
}

const workerSource = readFileSync(path.join(process.cwd(), "tools/rnd-worker/worker.ts"), "utf8");
const processSource = workerSource.slice(workerSource.indexOf("async function processJob("),
  workerSource.indexOf("async function launchGeminiSession("));
const compiledProcess = transformSync(processSource, { loader: "ts" }).code;

async function processWithMocks(page: Page, revokeAfterUpload = false) {
  const order: string[] = [];
  const prompt = "  Server-authoritative Italian Bob prompt.\nPreserve the image.  ";
  const hit = (value: string) => () => { order.push(value); };
  const deps = {
    GeminiModelSelectionError, path, OUTPUT_DIR: "mock-output", LEASE_HEARTBEAT_MS: 40_000,
    console: { log() {}, error() {} },
    setInterval: () => 0, clearInterval: () => {},
    downloadSource: () => { order.push("download"); return "mock-source.png"; },
    openGemini: hit("open"), assertReady: hit("ready"), freshChat: hit("fresh-chat"),
    selectGemini31Pro: async (p: Page) => { order.push("select"); await selectGemini31Pro(p); },
    openImageGenerationMode: hit("image-mode"),
    uploadReference: async () => {
      order.push("upload");
      if (revokeAfterUpload) await page.evaluate(() => { document.body.dataset.revoke = "true"; });
    },
    largeImages: () => [],
    verifyGemini31Pro: async (p: Page) => { order.push("verify-before-dispatch"); await verifyGemini31Pro(p); },
    markGenerationStarted: hit("quota-mark"),
    recordSubmission: (_job: unknown, phase: string) => { order.push(phase); },
    submitPrompt: (_page: Page, value: string) => { assert.equal(value, prompt); order.push("submit"); },
    waitForGeneratedImage: () => "mock-image", captureGeneratedImage: hit("capture"),
    uploadArtifact: () => { order.push("artifact"); return "mock-artifact"; },
    reportWithRetry: hit("report"), reportWorkerStatus: async () => {}, release: async () => { order.push("release"); },
  };
  const run = new Function(...Object.keys(deps),
    "let currentJobId, captureStatus, captureLastSuccessAt, captureLastError;\n" +
    compiledProcess + "\nreturn processJob;")(...Object.values(deps)) as
      (page: Page, job: object, profile: object) => Promise<string>;
  const outcome = await run(page, { id: "job", attemptNumber: 1, currentPrompt: prompt }, { id: "mock-profile" });
  return { outcome, order };
}

async function main() {
  const packaged = chromium.executablePath();
  const systemChrome = "C:/Program Files/Google/Chrome/Application/chrome.exe";
  const executablePath = existsSync(packaged) ? packaged :
    process.platform === "win32" && existsSync(systemChrome) ? systemChrome : undefined;
  const browser = await chromium.launch({
    executablePath, headless: true,
    args: ["--disable-background-networking", "--disable-component-update", "--disable-sync", "--no-first-run"],
  });
  try {
    const context = await browser.newContext({ offline: true, serviceWorkers: "block" });
    await context.route("**/*", (route) => route.abort());
    const page = await context.newPage();
    await mount(page, { description: true });
    await selectGemini31Pro(page);
    assert.deepEqual(await counters(page), { clicks: 1, opens: 2, menuVisible: false });

    await mount(page, { initial: "3.1 Pro" });
    await selectGemini31Pro(page);
    assert.deepEqual(await counters(page), { clicks: 0, opens: 1, menuVisible: false });

    await mount(page, { clickOutcome: "Flash" });
    await assert.rejects(selectGemini31Pro(page), /unambiguous selected state/);
    assert.equal((await counters(page)).clicks, 1);

    await mount(page, { initial: "3.1 Pro", markSelected: false });
    await assert.rejects(verifyGemini31Pro(page), /unambiguous selected state/);

    await mount(page, { missing: true });
    await assert.rejects(selectGemini31Pro(page), /one exact 3\.1 Pro option/);
    assert.equal((await counters(page)).clicks, 0);

    await mount(page, { noPicker: true });
    await assert.rejects(selectGemini31Pro(page), /Could not open the Gemini mode picker/);

    await mount(page, { keepOpen: true });
    await selectGemini31Pro(page);
    assert.deepEqual(await counters(page), { clicks: 1, opens: 2, menuVisible: false });

    await mount(page, { conflicting: true });
    await assert.rejects(selectGemini31Pro(page), /unambiguous selected state/);

    await mount(page);
    assert.deepEqual(await processWithMocks(page), { outcome: "CONTINUE", order: [
      "download", "open", "ready", "fresh-chat", "select", "image-mode", "upload",
      "verify-before-dispatch", "quota-mark", "begin", "submit", "submitted", "capture", "artifact", "report",
    ] });

    await mount(page, { markSelected: false });
    assert.deepEqual(await processWithMocks(page), { outcome: "STOP", order: [
      "download", "open", "ready", "fresh-chat", "select", "release",
    ] });

    await mount(page);
    assert.deepEqual(await processWithMocks(page, true), { outcome: "STOP", order: [
      "download", "open", "ready", "fresh-chat", "select", "image-mode", "upload", "verify-before-dispatch", "release",
    ] });
    console.log("PASS 11 offline picker and mocked worker scenarios; browser context was offline and all requests were intercepted.");
  } finally {
    await browser.close();
  }
}

void main().catch((error) => { console.error(error); process.exitCode = 1; });
