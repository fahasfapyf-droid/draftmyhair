import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DEFAULT_CARRIER_PROMPT_KEY,
  InternalRequestError,
  MAX_PROMPT_BLOCK_LENGTH,
  parseInternalOptimizerRequest,
} from "../../lib/internal/optimizer-request.ts";

function makeForm(overrides: Record<string, unknown> = {}) {
  const fd = new FormData();
  const file = new File(
    [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])],
    "ref.png",
    { type: "image/png" }
  );
  fd.set("reference", file);
  fd.set(
    "promptBlock",
    String(overrides.promptBlock ?? "candidate kicktail bob style block")
  );
  if (overrides.generationId !== undefined) {
    fd.set("generationId", String(overrides.generationId));
  }
  if (overrides.experimentId !== undefined) {
    fd.set("experimentId", String(overrides.experimentId));
  }
  if (overrides.metadata !== undefined) {
    fd.set("metadata", String(overrides.metadata));
  }
  return fd;
}

describe("internal optimizer request parser", () => {
  it("parses a valid request with defaults", async () => {
    const parsed = await parseInternalOptimizerRequest(makeForm(), undefined);
    assert.equal(parsed.promptBlock, "candidate kicktail bob style block");
    assert.match(parsed.generationId, /^[0-9a-f-]{36}$/);
    assert.equal(parsed.experimentId, null);
    assert.equal(parsed.metadata, null);
    assert.equal(parsed.carrierPromptKey, DEFAULT_CARRIER_PROMPT_KEY);
    assert.equal(parsed.image.mimeType, "image/png");
  });

  it("honors experimentId, generationId, metadata and carrier env", async () => {
    const fd = makeForm({
      generationId: "11111111-2222-4333-8444-555555555555",
      experimentId: "dmh-lab-1-7",
      metadata: '{"variant":"kicktail_bob|extras:2","iteration":0}',
    });
    const parsed = await parseInternalOptimizerRequest(
      fd,
      "soft-layered-bob"
    );
    assert.equal(parsed.generationId, "11111111-2222-4333-8444-555555555555");
    assert.equal(parsed.experimentId, "dmh-lab-1-7");
    assert.deepEqual(parsed.metadata, { variant: "kicktail_bob|extras:2", iteration: 0 });
    assert.equal(parsed.carrierPromptKey, "soft-layered-bob");
  });

  it("rejects a missing reference image", async () => {
    const fd = makeForm();
    fd.delete("reference");
    await assert.rejects(
      parseInternalOptimizerRequest(fd, undefined),
      (error) =>
        error instanceof InternalRequestError &&
        error.message === "Reference image is required."
    );
  });

  it("rejects an unsupported mime type", async () => {
    const fd = makeForm();
    fd.set(
      "reference",
      new File([new Uint8Array([1])], "ref.gif", { type: "image/gif" })
    );
    await assert.rejects(
      parseInternalOptimizerRequest(fd, undefined),
      (error) =>
        error instanceof InternalRequestError &&
        (error as InternalRequestError).status === 400
    );
  });

  it("rejects an oversized reference image", async () => {
    const fd = makeForm();
    fd.set(
      "reference",
      new File([new Uint8Array(10 * 1024 * 1024 + 1)], "ref.png", {
        type: "image/png",
      })
    );
    await assert.rejects(
      parseInternalOptimizerRequest(fd, undefined),
      (error) =>
        error instanceof InternalRequestError &&
        error.message.includes("10 MB")
    );
  });

  it("rejects a missing promptBlock", async () => {
    const fd = makeForm();
    fd.delete("promptBlock");
    await assert.rejects(
      parseInternalOptimizerRequest(fd, undefined),
      (error) => error instanceof InternalRequestError
    );
  });

  it("rejects an oversized promptBlock", async () => {
    const fd = makeForm({ promptBlock: "x".repeat(MAX_PROMPT_BLOCK_LENGTH + 1) });
    await assert.rejects(
      parseInternalOptimizerRequest(fd, undefined),
      (error) =>
        error instanceof InternalRequestError &&
        error.message.includes("promptBlock exceeds")
    );
  });

  it("rejects a non-UUID generationId", async () => {
    const fd = makeForm({ generationId: "not-a-uuid" });
    await assert.rejects(
      parseInternalOptimizerRequest(fd, undefined),
      (error) =>
        error instanceof InternalRequestError &&
        error.message === "generationId must be a UUID."
    );
  });

  it("rejects malformed metadata JSON", async () => {
    const fd = makeForm({ metadata: "{not json" });
    await assert.rejects(
      parseInternalOptimizerRequest(fd, undefined),
      (error) =>
        error instanceof InternalRequestError &&
        error.message === "metadata must be a JSON object string."
    );
  });

  it("rejects non-object metadata", async () => {
    const fd = makeForm({ metadata: "[1,2,3]" });
    await assert.rejects(
      parseInternalOptimizerRequest(fd, undefined),
      (error) =>
        error instanceof InternalRequestError &&
        error.message === "metadata must be a JSON object string."
    );
  });
});
