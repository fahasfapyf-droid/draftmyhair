import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { EventEmitter } from "node:events";
import { writeFile } from "node:fs/promises";
import { existsSync, readFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { transformSync } from "esbuild";
import { chromium, type Browser, type Download, type Page } from "playwright";
import { captureGeneratedImage, freshChat, GeminiCaptureError, GeminiConversationError, GeminiModelSelectionError, selectGemini31Pro,
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

async function processWithMocks(page: Page, { revokeAfterUpload = false, duplicate = false, chatFails = false,
  submissionFails = false, captureFails = false } = {}) {
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
      if (submissionFails) throw new GeminiConversationError("Gemini did not verify the submitted prompt and its new assistant turn. [PROMPT_MISMATCH]");
      return { user: { dispose: async () => {} }, assistant: { dispose: async () => {} } };
    },
    waitForGeneratedImage: () => "mock-image", captureGeneratedImage: () => {
      order.push("capture");
      if (captureFails) throw new GeminiConversationError("mock capture association lost");
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

type ConversationFixture = "missing" | "disabled" | "stays" | "no-user" | "wrong-user" | "wrong-assistant" | "idle-assistant" | "stale-image" | "valid" | "gemini-query-markup" | "gemini-query-offscreen" | "gemini-query-wrong" | "responsive-srcset" | "responsive-picture";

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
          if (fixture.startsWith("gemini-query-")) {
            label.replaceChildren();
            if (fixture === "gemini-query-offscreen") {
              label.style.cssText = "position:absolute;top:20000px;content-visibility:auto;contain-intrinsic-size:100px 100px";
            }
            const summary = document.createElement("h5");
            summary.className = "cdk-visually-hidden screen-reader-user-query-label";
            summary.style.cssText = "position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)";
            summary.textContent = "You said A screen-reader summary of the submitted prompt";
            label.append(summary);
            for (const line of input.value.split("\\n")) {
              const numbered = line.match(/^(\\d+)\\. (.*)$/);
              if (numbered) {
                const list = document.createElement("ol");
                list.className = "query-numbered-list";
                list.start = Number(numbered[1]);
                const item = document.createElement("li");
                item.className = "query-numbered-item";
                item.textContent = numbered[2];
                list.append(item);
                label.append(list);
              } else {
                const paragraph = document.createElement("p");
                paragraph.className = "query-text-line";
                paragraph.textContent = fixture === "gemini-query-wrong" ? "Different prompt content" : line;
                label.append(paragraph);
              }
            }
          }
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
        if (["valid", "stale-image", "responsive-srcset", "responsive-picture"].includes(fixture)) {
          const canvas = document.createElement("canvas");
          canvas.width = 640; canvas.height = 768;
          const bitmap = canvas.getContext("2d");
          bitmap.fillStyle = "navy"; bitmap.fillRect(0, 0, 640, 768);
          const generated = document.createElement("generated-image");
          const img = new Image();
          img.width = 64; img.height = 76;
          const dataUrl = canvas.toDataURL("image/png");
          const payload = Uint8Array.from(atob(dataUrl.split(",")[1]), byte => byte.charCodeAt(0));
          const objectUrl = URL.createObjectURL(new Blob([payload], { type: "image/png" }));
          img.src = fixture.startsWith("responsive-") ? objectUrl : dataUrl;
          if (fixture === "responsive-srcset") img.srcset = objectUrl + " 1x";
          if (fixture === "responsive-picture") {
            const picture = document.createElement("picture");
            const source = document.createElement("source");
            source.srcset = objectUrl;
            picture.append(source, img);
            generated.append(picture);
          } else {
            generated.append(img);
          }
          const download = document.createElement("button");
          download.setAttribute("aria-label", "Download full size");
          download.textContent = "Download full size";
          download.onclick = () => {
            if (window.mockNativeDownload) return window.mockNativeDownload();
            const anchor = document.createElement("a");
            anchor.href = URL.createObjectURL(new Blob([payload], { type: "image/png" }));
            anchor.download = "Gemini_Generated_Image.png";
            anchor.click();
          };
          generated.append(download);
          (fixture === "stale-image" ? document.body : response).append(generated);
        }
      };
    </script>` }));
  try { await page.goto(url); } finally { await page.unroute(url); }
}

async function testConversation(page: Page) {
  const prompt = "  Exact fixture prompt.\nKeep framing.  ";
  const markupPrompt = "Exact fixture prompt.\nKeep framing.\n1. Preserve identity.\n2. Change hair only.";
  for (const fixture of ["gemini-query-markup", "gemini-query-offscreen", "gemini-query-wrong"] as const) {
    await mountConversation(page, fixture);
    const markupPath = await freshChat(page, 800);
    if (fixture === "gemini-query-wrong") {
      await assert.rejects(submitPrompt(page, markupPrompt, markupPath, 350), /PROMPT_MISMATCH/);
      continue;
    }
    const markupTurn = await submitPrompt(page, markupPrompt, markupPath, 800);
    const rendered = await page.locator("user-query .query-text").innerText();
    if (fixture === "gemini-query-offscreen") {
      assert.equal(rendered, "", "offscreen Gemini prompt must exercise content-visibility text omission");
    } else {
      assert.match(rendered, /You said A screen-reader summary/);
      assert.notEqual(rendered.replace(/\s+/g, " ").trim(), markupPrompt.replace(/\s+/g, " ").trim());
    }
    await Promise.all([markupTurn.user.dispose(), markupTurn.assistant.dispose()]);
  }
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
  for (const fixture of ["stale-image", "valid", "responsive-srcset", "responsive-picture"] as const) {
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
      const originalBytes = Buffer.from(await page.evaluate(async source => Array.from(new Uint8Array(await (await fetch(source)).arrayBuffer())), image.src));
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

async function testNativeDownloads(browser: Browser) {
  const scenarios = [
    ["real-native-persistence", null], ["revoked-preview", null], ["larger-original", null],
    ["jpeg-original", null], ["webp-original", null], ["wrong-control", "RND_CAPTURE_CONTROL_UNAVAILABLE"],
    ["wrong-image-control", "RND_CAPTURE_CONTROL_NOT_ASSOCIATED"],
    ["wrong-turn", "RND_CAPTURE_TURN_CHANGED"], ["wrong-page", "RND_CAPTURE_UNEXPECTED_DOWNLOAD"],
    ["interfering-click", "RND_CAPTURE_UNEXPECTED_DOWNLOAD"],
    ["wrong-origin", "RND_CAPTURE_UNEXPECTED_DOWNLOAD"], ["duplicate-controls", "RND_CAPTURE_DUPLICATE_CONTROLS"],
    ["duplicate-downloads", "RND_CAPTURE_UNEXPECTED_DOWNLOAD"], ["timeout", "RND_CAPTURE_TIMEOUT"],
    ["save-timeout", "RND_CAPTURE_TIMEOUT"],
    ["cancelled", "RND_CAPTURE_DOWNLOAD_CANCELLED"], ["save-failed", "RND_CAPTURE_SAVE_FAILED"],
    ["download-failed", "RND_CAPTURE_DOWNLOAD_FAILED"], ["invalid-mime", "RND_CAPTURE_INVALID_MIME"],
    ["empty", "RND_CAPTURE_INVALID_SIZE"], ["oversized", "RND_CAPTURE_INVALID_SIZE"],
    ["truncated", "RND_CAPTURE_INVALID_SIZE"], ["invalid-image", "RND_CAPTURE_INVALID_IMAGE"],
    ["small-dimensions", "RND_CAPTURE_INVALID_DIMENSIONS"], ["wrong-aspect", "RND_CAPTURE_INVALID_DIMENSIONS"],
    ["browser-shutdown", "RND_CAPTURE_BROWSER_CLOSED"],
  ] as const;
  for (const [scenario, expected] of scenarios) {
    const context = await browser.newContext({ offline: true, acceptDownloads: true, serviceWorkers: "block" });
    await context.route("**/*", route => route.abort());
    const page = await context.newPage();
    let clicks = 0;
    let downloadEvents = 0;
    page.on("download", () => { downloadEvents++; });
    let fileSaved = false;
    let bytes = Buffer.alloc(0);
    let otherPage: Page | null = null;
    const errorLog: string[] = [];
    const originalError = console.error;
    try {
      if (scenario !== "real-native-persistence") await page.exposeFunction("mockNativeDownload", () => {
        clicks++;
        if (scenario === "timeout") return;
        const download = {
          page: () => otherPage ?? page,
          url: () => scenario === "wrong-origin" ? "https://untrusted.invalid/private?credential=DO_NOT_LOG_THIS" : "https://lh3.googleusercontent.com/native-full-size",
          saveAs: async (filename: string) => {
            if (scenario === "browser-shutdown") {
              void context.close();
              return new Promise<void>(() => undefined);
            }
            if (scenario === "save-timeout") return new Promise<void>(() => undefined);
            if (scenario === "cancelled" || scenario === "save-failed") throw new Error("DO_NOT_LOG_THIS signed URL provider error");
            await writeFile(filename, bytes);
            fileSaved = true;
            if (scenario === "wrong-turn") await page.locator("model-response").evaluate(el => el.replaceWith(el.cloneNode(true)));
            if (scenario === "interfering-click") await page.locator("user-query").click();
          },
          failure: async () => scenario === "cancelled" ? "canceled DO_NOT_LOG_THIS" :
            scenario === "download-failed" ? "network provider error DO_NOT_LOG_THIS" : null,
          cancel: async () => undefined,
        } as unknown as Download;
        (page as unknown as EventEmitter).emit("download", download);
        if (scenario === "duplicate-downloads") (page as unknown as EventEmitter).emit("download", download);
      });
      await mountConversation(page, "responsive-srcset");
      const turn = await submitPrompt(page, "Fixture prompt", await freshChat(page, 800), 800);
      const image = await waitForGeneratedImage(page, turn, 800);
      const mime = scenario === "jpeg-original" ? "image/jpeg" : scenario === "webp-original" ? "image/webp" : "image/png";
      bytes = Buffer.from(await page.evaluate(({ width, height, mime }) => {
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = "navy"; ctx.fillRect(0, 0, width, height);
        return canvas.toDataURL(mime).split(",")[1];
      }, { width: scenario === "larger-original" ? 1280 : scenario === "small-dimensions" ? 1 : scenario === "wrong-aspect" ? 768 : 640,
        height: scenario === "larger-original" ? 1536 : scenario === "small-dimensions" ? 1 : 768, mime }), "base64");
      if (scenario === "revoked-preview") {
        await page.evaluate(src => URL.revokeObjectURL(src), image.src);
        assert.equal(await page.evaluate(async src => { try { await fetch(src); return true; } catch { return false; } }, image.src), false,
          "regression control: the displayed preview URL really is revoked");
      }
      if (scenario === "wrong-control") await page.locator("generated-image button").evaluate(el => document.body.append(el));
      if (scenario === "wrong-image-control") await page.locator("generated-image button").evaluate(el => el.closest("model-response")!.append(el));
      if (scenario === "wrong-page") otherPage = await context.newPage();
      if (scenario === "duplicate-controls") await page.locator("generated-image button").evaluate(el => el.after(el.cloneNode(true)));
      if (scenario === "invalid-mime") bytes = Buffer.from("<html>DO_NOT_LOG_THIS</html>");
      if (scenario === "empty") bytes = Buffer.alloc(0);
      if (scenario === "oversized") bytes = Buffer.alloc(15 * 1024 * 1024 + 1);
      if (scenario === "truncated") bytes = bytes.subarray(0, 8);
      if (scenario === "invalid-image") bytes = bytes.subarray(0, 33);
      const base = path.join(mkdtempSync(path.join(tmpdir(), "dmh-native-download-")), "artifact");
      console.error = (...args: unknown[]) => { errorLog.push(JSON.stringify(args)); };
      if (expected) {
        const pending = captureGeneratedImage(page, base, turn, image, scenario === "timeout" || scenario === "save-timeout" ? 800 : 2500);
        if (scenario === "timeout") await assert.rejects(captureGeneratedImage(page, base, turn, image),
          (error: unknown) => error instanceof GeminiCaptureError && error.code === "RND_CAPTURE_ALREADY_ACTIVE");
        await assert.rejects(pending,
          (error: unknown) => error instanceof GeminiCaptureError && error.code === expected, scenario);
        assert.equal(clicks, scenario === "wrong-control" || scenario === "wrong-image-control" || scenario === "duplicate-controls" ? 0 : 1,
          "never retry download clicks after a failure");
      } else {
        const result = await captureGeneratedImage(page, base, turn, image, 2500);
        assert.equal(downloadEvents, 1);
        if (scenario !== "real-native-persistence") { assert.equal(clicks, 1); assert.equal(fileSaved, true); }
        assert.equal(result.mimeType, mime);
        assert.equal(result.fileSize, bytes.length);
        assert.equal(result.checksum, createHash("sha256").update(bytes).digest("hex"));
        assert.deepEqual(readFileSync(result.filePath), bytes);
        assert.deepEqual([result.width, result.height], scenario === "larger-original" ? [1280, 1536] : [640, 768]);
        await context.close();
        assert.deepEqual(readFileSync(result.filePath), bytes, "persistent original survives browser-context cleanup");
      }
      assert.equal(errorLog.join(" ").includes("DO_NOT_LOG_THIS"), false, "capture diagnostics never leak raw provider data or URLs");
      await Promise.allSettled([turn.user.dispose(), turn.assistant.dispose()]);
      console.log(`PASS offline native download: ${scenario}`);
    } finally {
      console.error = originalError;
      await context.close();
    }
  }
}

async function main() {
  const captureSource = readFileSync(new URL("./gemini-page.ts", import.meta.url), "utf8").split("export async function captureGeneratedImage")[1];
  assert.doesNotMatch(captureSource, /\bfetch\s*\(|\.request\.|\.screenshot\s*\(|\.toDataURL\s*\(|\.toBlob\s*\(/,
    "static wiring guard: native originals must never be replaced by preview acquisition");
  assert.match(captureSource, /page\.waitForEvent\("download"/);
  assert.match(captureSource, /download\.saveAs\(pendingPath\)/);
  console.log("PASS static: native download wiring and absence of preview/screenshot/canvas fallbacks.");
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
    assert.deepEqual(await processWithMocks(page, { duplicate: true }), { outcome: "RECONCILE", order: [
      "download", "open", "ready", "fresh-chat", "select", "image-mode", "upload", "verify-before-dispatch",
      "verify-empty-conversation", "quota-mark", "begin", "submit", "submitted", "capture",
    ] });
    await mount(page);
    assert.deepEqual(await processWithMocks(page, { chatFails: true }), { outcome: "STOP", order: [
      "download", "open", "ready", "fresh-chat", "release",
    ] });
    await mount(page);
    assert.deepEqual(await processWithMocks(page, { submissionFails: true }), { outcome: "RECONCILE", order: [
      "download", "open", "ready", "fresh-chat", "select", "image-mode", "upload", "verify-before-dispatch",
      "verify-empty-conversation", "quota-mark", "begin", "submit",
    ] });
    await mount(page);
    assert.deepEqual(await processWithMocks(page, { captureFails: true }), { outcome: "RECONCILE", order: [
      "download", "open", "ready", "fresh-chat", "select", "image-mode", "upload", "verify-before-dispatch",
      "verify-empty-conversation", "quota-mark", "begin", "submit", "submitted", "capture",
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
    await testNativeDownloads(browser);
    console.log("PASS offline picker, conversation/capture, native downloads (26 scenarios), and mocked worker dispatch and duplicate guards.");
  } finally {
    await browser.close();
  }
}

void main().catch((error) => { console.error(error); process.exitCode = 1; });
