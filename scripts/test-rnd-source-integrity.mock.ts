/** Real source-read implementation with mocked transport; no Blob/HTTP access. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fetchRndSourceAsset } from "../lib/rnd/source-asset";

async function main() {
  const savedFetch = globalThis.fetch, saved = process.env.RND_BLOB_READ_WRITE_TOKEN, legacyToken = process.env.BLOB_READ_WRITE_TOKEN;
  process.env.RND_BLOB_READ_WRITE_TOKEN = "fixture-only-never-a-real-token";
  const bytes = Buffer.from("synthetic source");
  const asset = { storageKey: "rnd/sources/test", blobUrl: "https://fixture.invalid/source", mimeType: "image/png", fileSize: bytes.length, checksum: createHash("sha256").update(bytes).digest("hex") };
  let calls = 0;
  try {
    globalThis.fetch = async (_url, init) => { calls++; assert.equal(init?.redirect, "error"); return new Response(bytes); };
    assert.deepEqual((await fetchRndSourceAsset(asset, "https://app-fixture.invalid", null)).buffer, bytes);
    for (const invalid of [{ ...asset, fileSize: bytes.length + 1 }, { ...asset, checksum: "0".repeat(64) }, { ...asset, checksum: null }]) await assert.rejects(fetchRndSourceAsset(invalid, "https://app-fixture.invalid", null), /INTEGRITY_MISMATCH/);
    globalThis.fetch = async () => { throw new Error("simulated network/redirect rejection"); };
    await assert.rejects(fetchRndSourceAsset(asset, "https://app-fixture.invalid", null), /could not be retrieved/);
    const legacyBytes = readFileSync("public/portfolio/bob/french-bob-before.webp");
    const legacy = { ...asset, storageKey: "rnd/sources/d100a15e9731e6532dec84c6e72bdab753084dba93cfe21651a48759a8368d9d-50736ff4-39ac-4cac-be66-9b15704fa1c6.webp", checksum: "d100a15e9731e6532dec84c6e72bdab753084dba93cfe21651a48759a8368d9d", fileSize: 1126530 };
    assert.equal(legacyBytes.length, legacy.fileSize); assert.equal(createHash("sha256").update(legacyBytes).digest("hex"), legacy.checksum);
    globalThis.fetch = async (url, init) => { assert.equal(init?.redirect, "error"); return String(url) === asset.blobUrl ? new Response(null, { status: 403 }) : new Response(legacyBytes); };
    assert.deepEqual((await fetchRndSourceAsset(legacy, "https://app-fixture.invalid", null)).buffer, legacyBytes);
    globalThis.fetch = async url => String(url) === asset.blobUrl ? new Response(null, { status: 403 }) : new Response(bytes);
    await assert.rejects(fetchRndSourceAsset(legacy, "https://app-fixture.invalid", null), /could not be retrieved/);
    process.env.BLOB_READ_WRITE_TOKEN = "fixture-legacy-must-not-be-used";
    delete process.env.RND_BLOB_READ_WRITE_TOKEN; const before = calls;
    await assert.rejects(fetchRndSourceAsset(asset, "https://app-fixture.invalid", null), /not configured/); assert.equal(calls, before);
    console.log("PASS source byte size/SHA-256, missing checksum/token, network/redirect failure, preserved exact legacy fallback and corrupt fallback rejection; mocked transport only.");
  } finally { globalThis.fetch = savedFetch; if (saved === undefined) delete process.env.RND_BLOB_READ_WRITE_TOKEN; else process.env.RND_BLOB_READ_WRITE_TOKEN = saved;
    if (legacyToken === undefined) delete process.env.BLOB_READ_WRITE_TOKEN; else process.env.BLOB_READ_WRITE_TOKEN = legacyToken; }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
