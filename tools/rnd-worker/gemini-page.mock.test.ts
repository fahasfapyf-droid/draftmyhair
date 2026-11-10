import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { transformSync } from "esbuild";
import { chromium, type Page } from "playwright";
import { captureGeneratedImage, freshChat, GeminiConversationError, GeminiModelSelectionError, selectGemini31Pro,
  submitPrompt, verifyGemini31Pro, waitForGeneratedImage } from "./gemini-page.js";

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

async function processWithMocks(page: Page, { revokeAfterUpload = false, duplicate = false, chatFails = false } = {}) {
  const order: string[] = [];
  const prompt = "  Server-authoritative Italian Bob prompt.\nPreserve the image.  ";
  const hit = (value: string) => () => { order.push(value); };
  const deps = {
    GeminiConversationError, GeminiModelSelectionError, path, OUTPUT_DIR: "mock-output", LEASE_HEARTBEAT_MS: 40_000,
    console: { log() {}, error() {} },
    setInterval: () => 0, clearInterval: () => {},
    downloadSource: () => { order.push("download"); return "mock-source.png"; },
    openGemini: hit("open"), assertReady: hit("ready"), freshChat: () => {
      order.push("fresh-chat");
      if (chatFails) throw new GeminiConversationError("mock fresh chat failure");
      return "/app";
    },
    selectGemini31Pro: async (p: Page) => { order.push("select"); await selectGemini31Pro(p); },
    openImageGenerationMode: hit("image-mode"),
    uploadReference: async () => {
      order.push("upload");
      if (revokeAfterUpload) await page.evaluate(() => { document.body.dataset.revoke = "true"; });
    },
    prepareGeminiSubmission: hit("verify-empty-conversation"),
    verifyGemini31Pro: async (p: Page) => { order.push("verify-before-dispatch"); await verifyGemini31Pro(p); },
    markGenerationStarted: hit("quota-mark"), classifyProfileError: () => null,
    recordSubmission: (_job: unknown, phase: string) => { order.push(phase); },
    submitPrompt: (_page: Page, value: string) => {
      assert.equal(value, prompt);
      order.push("submit");
      return { user: { dispose: async () => {} }, assistant: { dispose: async () => {} } };
    },
    waitForGeneratedImage: () => "mock-image", captureGeneratedImage: () => {
      order.push("capture");
      return { filePath: "mock-output.png", checksum: "a".repeat(64) };
    },
    uploadArtifact: () => { order.push("artifact"); return "mock-artifact"; },
    reportWithRetry: hit("report"), reportWorkerStatus: async () => {}, release: async () => { order.push("release"); },
  };
  const run = new Function(...Object.keys(deps),
    "let currentJobId, captureStatus, captureLastSuccessAt, captureLastError;\n" +
    compiledProcess + "\nreturn processJob;")(...Object.values(deps)) as
      (page: Page, job: object, profile: object) => Promise<string>;
  const outcome = await run(page, { id: "job", attemptNumber: 1, currentPrompt: prompt, priorArtifactChecksums: duplicate ? ["a".repeat(64)] : [] }, { id: "mock-profile" });
  return { outcome, order };
}

type ConversationFixture = "missing" | "disabled" | "stays" | "no-user" | "wrong-user" | "wrong-assistant" | "idle-assistant" | "stale-image" | "valid";

async function mountConversation(page: Page, fixture: ConversationFixture) {
  const url = "https://gemini.google.com/app/old-fixture";
  await page.route(url, route => route.fulfill({ contentType: "text/html", body: `
    <button id="new-chat" ${fixture === "missing" ? "hidden" : fixture === "disabled" ? "disabled" : ""}>New chat</button>
    <textarea aria-label="Ask Gemini"></textarea><button id="send">Send message</button>
    <div id="thread"><conversation-turn style="display:block"><user-query>Old user</user-query><model-response>Old assistant</model-response></conversation-turn></div>
    <script>
      const fixture = ${JSON.stringify(fixture)};
      const thread = document.querySelector("#thread");
      document.querySelector("#new-chat").onclick = () => {
        if (fixture === "stays") return;
        thread.replaceChildren();
        history.replaceState(null, "", "/app");
      };
      document.querySelector("#send").onclick = () => {
        history.replaceState(null, "", "/app/new-fixture");
        const input = document.querySelector("textarea");
        const group = document.createElement("conversation-turn");
        group.style.display = "block";
        if (fixture !== "no-user") {
          const user = document.createElement("user-query");
          const label = document.createElement("p");
          label.className = "query-text";
          label.textContent = fixture === "wrong-user" ? "Other prompt" : input.value;
          user.append(label);
          group.append(user);
        }
        const response = document.createElement("model-response");
        response.style.display = "block";
        const content = document.createElement("message-content");
        if (fixture !== "idle-assistant") {
          response.setAttribute("aria-busy", "true");
          content.textContent = "Processing fixture";
        }
        response.append(content);
        if (fixture === "wrong-assistant") {
          const unrelated = document.createElement("conversation-turn");
          unrelated.append(response);
          thread.append(unrelated);
        } else {
          group.append(response);
        }
        thread.append(group);
        if (fixture === "valid" || fixture === "stale-image") {
          const canvas = document.createElement("canvas");
          canvas.width = 640; canvas.height = 768;
          const bitmap = canvas.getContext("2d");
          bitmap.fillStyle = "navy"; bitmap.fillRect(0, 0, 640, 768);
          const generated = document.createElement("generated-image");
          const img = new Image();
          img.width = 64; img.height = 76;
          img.src = canvas.toDataURL("image/png");
          generated.append(img);
          (fixture === "valid" ? response : document.body).append(generated);
        }
      };
    </script>` }));
  try { await page.goto(url); } finally { await page.unroute(url); }
}

async function testConversation(page: Page) {
  const prompt = "  Exact fixture prompt.\nKeep framing.  ";
  for (const fixture of ["missing", "disabled", "stays"] as const) {
    await mountConversation(page, fixture);
    await assert.rejects(freshChat(page, 350), /new chat could not be verified/);
  }
  for (const fixture of ["no-user", "wrong-user", "wrong-assistant", "idle-assistant"] as const) {
    await mountConversation(page, fixture);
    const freshPath = await freshChat(page, 800);
    assert.equal(freshPath, "/app");
    await assert.rejects(submitPrompt(page, prompt, freshPath, 350), /did not verify/);
  }
  for (const fixture of ["stale-image", "valid"] as const) {
    await mountConversation(page, fixture);
    const freshPath = await freshChat(page, 800);
    const turn = await submitPrompt(page, prompt, freshPath, 800);
    try {
      if (fixture === "stale-image") {
        assert.equal(await page.locator("generated-image img").count(), 1, "fixture adds a fresh image element");
        await assert.rejects(waitForGeneratedImage(page, turn, 350), /Timed out waiting for a verified image/);
        continue;
      }
      const image = await waitForGeneratedImage(page, turn, 800);
      assert.deepEqual([image.width, image.height], [640, 768]);
      const base = path.join(mkdtempSync(path.join(tmpdir(), "dmh-capture-mock-")), "image");
      const captured = await captureGeneratedImage(page, base, turn, image);
      const originalBytes = Buffer.from(image.src.split(",")[1], "base64");
      assert.deepEqual(readFileSync(captured.filePath), originalBytes);
      assert.equal(captured.checksum, createHash("sha256").update(originalBytes).digest("hex"));
      await page.locator("model-response").evaluate(el => el.replaceWith(el.cloneNode(true)));
      await assert.rejects(waitForGeneratedImage(page, turn, 350), /current assistant turn changed/);
    } finally {
      await Promise.all([turn.user.dispose(), turn.assistant.dispose()]);
    }
  }
  console.log("PASS offline: missing/blocked/stale chat, absent user turn, wrong assistant, stale image, intrinsic capture and replaced response.");
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
      "verify-before-dispatch", "verify-empty-conversation", "quota-mark", "begin", "submit", "submitted", "capture", "artifact", "report",
    ] });

    await mount(page, { markSelected: false });
    assert.deepEqual(await processWithMocks(page), { outcome: "STOP", order: [
      "download", "open", "ready", "fresh-chat", "select", "release",
    ] });

    await mount(page);
    assert.deepEqual(await processWithMocks(page, { revokeAfterUpload: true }), { outcome: "STOP", order: [
      "download", "open", "ready", "fresh-chat", "select", "image-mode", "upload", "verify-before-dispatch", "release",
    ] });
    await mount(page);
    assert.deepEqual(await processWithMocks(page, { duplicate: true }), { outcome: "STOP", order: [
      "download", "open", "ready", "fresh-chat", "select", "image-mode", "upload", "verify-before-dispatch",
      "verify-empty-conversation", "quota-mark", "begin", "submit", "submitted", "capture",
    ] });
    await mount(page);
    assert.deepEqual(await processWithMocks(page, { chatFails: true }), { outcome: "STOP", order: [
      "download", "open", "ready", "fresh-chat", "release",
    ] });
    const assistantDiagnostics = new Map<string, Record<string, unknown>>();
    const log = console.log;
    console.log = (message, ...args) => {
      if (message === "Gemini prompt and assistant turn verified" || message === "Gemini current-turn image captured") {
        assistantDiagnostics.set(message, args[0]);
      }
      log(message, ...args);
    };
    try {
      await testConversation(page);
    } finally {
      console.log = log;
    }
    for (const message of ["Gemini prompt and assistant turn verified", "Gemini current-turn image captured"]) {
      const diagnostic = assistantDiagnostics.get(message);
      assert.ok(diagnostic);
      assert.equal(diagnostic.assistantTurnOrdinal, 1);
      assert.equal(Object.hasOwn(diagnostic, "assistantTurn"), false);
    }
    console.log("PASS offline picker, conversation/capture, and mocked worker dispatch and duplicate guards.");
  } finally {
    await browser.close();
  }
}

void main().catch((error) => { console.error(error); process.exitCode = 1; });
