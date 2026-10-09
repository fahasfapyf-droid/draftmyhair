import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { captureGeneratedImage } from "./gemini-page.ts";
import { attemptArtifactFilename, sha256Hex } from "./artifact-integrity.ts";

test("capture writes bytes fetched from the exact generated-image URL", async () => {
  const generatedUrl = "https://gemini.google.com/generated-fixture/image-42.png";
  const fixtureBytes = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3, 4]);
  const requestedUrls = [];
  const page = {
    request: {
      async get(url) {
        requestedUrls.push(url);
        return { ok: () => true, body: async () => Buffer.from(fixtureBytes) };
      },
    },
  };
  const directory = await mkdtemp(path.join(tmpdir(), "dmh-capture-fixture-"));
  const outputPath = path.join(directory, "fixture-attempt-2.png");
  try {
    await captureGeneratedImage(page, outputPath, generatedUrl, new Set());
    const capturedBytes = await readFile(outputPath);
    assert.deepEqual(requestedUrls, [generatedUrl]);
    assert.deepEqual(capturedBytes, fixtureBytes);
    assert.equal(sha256Hex(capturedBytes), sha256Hex(fixtureBytes));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("attempt artifact filenames preserve job and attempt association", () => {
  assert.equal(attemptArtifactFilename("job-fixture-123", 1), "job-fixture-123-attempt-1.png");
  assert.equal(attemptArtifactFilename("job-fixture-123", 2), "job-fixture-123-attempt-2.png");
  assert.notEqual(attemptArtifactFilename("job-fixture-123", 1), attemptArtifactFilename("job-fixture-123", 2));
  assert.throws(() => attemptArtifactFilename("job-fixture-123", 0), /positive integer/);
  assert.throws(() => attemptArtifactFilename("", 1), /jobId is required/);
});

test("SHA-256 distinguishes different fixture bytes and is stable for identical bytes", () => {
  const first = Buffer.from("generated image fixture A");
  const same = Buffer.from("generated image fixture A");
  const different = Buffer.from("generated image fixture B");
  assert.equal(sha256Hex(first), sha256Hex(same));
  assert.notEqual(sha256Hex(first), sha256Hex(different));
});
