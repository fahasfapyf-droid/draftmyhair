import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { transform } from "esbuild";
import { get, list } from "@vercel/blob";
import { MockAgent, getGlobalDispatcher, setGlobalDispatcher } from "undici";

const legacyStore = "ZjSA3cZUbKwe6YuA";
const destinationStore = "ErwFOk17AEWS4n1e";
const otherStore = "SyntheticOther01";
const host = (store: string) => store.toLowerCase() + ".private.blob.vercel-storage.com";
const origin = (store: string) => "https://" + host(store);
const token = (store: string) => "vercel_blob_rw_" + store + "_synthetic";
const assets = [
  {
    id: "cmv6kq8cl0001l206f02g8q1f",
    storageKey: "rnd/sources/d100a15e9731e6532dec84c6e72bdab753084dba93cfe21651a48759a8368d9d-50736ff4-39ac-4cac-be66-9b15704fa1c6.webp",
    fileSize: 1_126_530,
  },
  {
    id: "cmv6lrbgy0001l906hqzewg72",
    storageKey: "rnd/attempts/cmv6kq8dq0005l2067u1olmwh/1-5d9e561c024cfeeb749c4b5acea3dfeaba2d4a11645b2ff2036d66a99628e521.png",
    fileSize: 922_012,
  },
  {
    id: "cmvdlfi530005k1084fhkfm1u",
    storageKey: "rnd/attempts/cmvc359we0004l007lsynpuun/2-5d9e561c024cfeeb749c4b5acea3dfeaba2d4a11645b2ff2036d66a99628e521.png",
    fileSize: 922_012,
  },
].map((asset, index) => {
  // Same IDs, keys and sizes as the real records. Use synthetic image bytes
  // and their hashes so this test requires neither customer data nor secrets.
  const bytes = Buffer.alloc(asset.fileSize, index ? 2 : 1);
  return { ...asset, bytes, blobUrl: origin(legacyStore) + "/" + asset.storageKey,
    checksum: createHash("sha256").update(bytes).digest("hex") };
});

const route = "app/api/rnd/admin/blob-diagnostics/route.ts";
const auth = { session: { user: { id: "fixture-admin", role: "ADMIN" } } };
let rows = assets.map(({ id, storageKey, fileSize, blobUrl, checksum }) => ({ id, storageKey, fileSize, blobUrl, checksum }));
let databaseReads = 0;

async function loadHandler() {
  const { code } = await transform(readFileSync(route, "utf8"), { loader: "ts", format: "cjs", platform: "node" });
  const modules: Record<string, unknown> = {
    "node:crypto": { createHash },
    "@vercel/blob": { get, list },
    "next/server": { NextResponse: { json: Response.json } },
    "@/auth": { auth: async () => auth.session },
    "@/lib/prisma": { prisma: { rnDAsset: { findMany: async () => { databaseReads++; return rows; } } } },
  };
  const module = { exports: {} as { GET: () => Promise<Response> } };
  new Function("require", "module", "exports", code)((name: string) => {
    assert.ok(Object.hasOwn(modules, name), "unexpected handler import");
    return modules[name];
  }, module, module.exports);
  return module.exports.GET;
}

function listPage(mock: MockAgent, store: string, keys: string[], options: { cursor?: string; next?: string; urlStore?: string } = {}) {
  const query = new URLSearchParams({ limit: "1000", prefix: "rnd/" });
  if (options.cursor) query.set("cursor", options.cursor);
  mock.get("https://vercel.com").intercept({
    path: "/api/blob?" + query.toString(), method: "GET",
    headers: { authorization: "Bearer " + token(store), "x-vercel-blob-store-id": store },
  }).reply(200, {
    blobs: keys.map((pathname) => ({ pathname, url: origin(options.urlStore ?? store) + "/" + pathname })),
    hasMore: Boolean(options.next), cursor: options.next,
  });
}

function read(mock: MockAgent, store: string, asset: typeof assets[number], status: number, times = 1) {
  mock.get(origin(legacyStore)).intercept({
    path: "/" + asset.storageKey, method: "GET", headers: { authorization: "Bearer " + token(store) },
  }).reply(status, status === 200 ? asset.bytes : "synthetic failure").times(times);
}

async function main() {
  const mock = new MockAgent();
  mock.disableNetConnect();
  const dispatcher = getGlobalDispatcher();
  const oldEnv = { ...process.env };
  setGlobalDispatcher(mock);
  process.env.BLOB_READ_WRITE_TOKEN = token(legacyStore);
  process.env.RND_BLOB_READ_WRITE_TOKEN = token(destinationStore);
  delete process.env.VERCEL_BLOB_API_URL;
  const keys = assets.map((asset) => asset.storageKey);

  try {
    const GET = await loadHandler();
    auth.session.user.role = "USER";
    assert.equal((await GET()).status, 401);
    assert.equal(databaseReads, 0);
    auth.session.user.role = "ADMIN";
    console.log("PASS admin authentication precedes database and Blob access");

    listPage(mock, legacyStore, keys.slice(0, 1), { next: "page-two" });
    listPage(mock, legacyStore, keys.slice(1), { cursor: "page-two" });
    listPage(mock, destinationStore, []);
    for (const asset of assets) read(mock, legacyStore, asset, 200, 2);
    const response = await GET();
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    const success = await response.json();
    assert.equal(success.credentials.source.storeIdentityVerified, true);
    assert.equal(success.credentials.source.storeId, "store_" + legacyStore);
    assert.equal(success.credentials.source.matchesExpected, true);
    assert.equal(success.credentials.source.observedHost, host(legacyStore));
    assert.equal(success.credentials.source.pages, 2);
    assert.equal(success.database.sourceObjectChecks.length, 3);
    for (const [index, check] of success.database.sourceObjectChecks.entries()) {
      assert.equal(check.assetId, assets[index].id);
      assert.equal(check.storageKey, keys[index]);
      assert.equal(check.listing.exactPathExists, true);
      assert.equal(check.listing.canonicalUrlPathMatchesKey, true);
      const expected = { stage: "integrity", outcome: "verified", status: 200, size: assets[index].fileSize,
        sizeMatches: true, checksumMatches: true };
      assert.deepEqual(check.urlLookup, expected);
      assert.deepEqual(check.pathnameLookup, expected);
    }
    assert.ok(!JSON.stringify(success).includes("_synthetic"));
    console.log("PASS authenticated store, exact matches across two pages, six private reads and byte integrity");

    listPage(mock, legacyStore, []);
    listPage(mock, destinationStore, []);
    for (const asset of assets) read(mock, legacyStore, asset, 200, 2);
    const empty = (await (await GET()).json()).credentials.source;
    assert.equal(empty.accepted, true);
    assert.equal(empty.outcome, "complete");
    assert.equal(empty.count, 0);
    assert.equal(empty.observedHost, null);
    assert.equal(empty.storeIdentityVerified, false);
    assert.equal(empty.storeId, null);
    assert.equal(empty.matchesExpected, null);
    console.log("PASS a successful empty listing cannot establish store identity");

    listPage(mock, legacyStore, keys.slice(0, 1), { next: "conflicting-page" });
    listPage(mock, legacyStore, keys.slice(1), { cursor: "conflicting-page", urlStore: otherStore });
    listPage(mock, destinationStore, []);
    for (const asset of assets) read(mock, legacyStore, asset, 200);
    const conflict = await (await GET()).json();
    assert.equal(conflict.credentials.source.accepted, true);
    assert.equal(conflict.credentials.source.observedHost, host(legacyStore));
    assert.equal(conflict.credentials.source.conflictingHosts, true);
    assert.equal(conflict.credentials.source.storeIdentityVerified, false);
    assert.equal(conflict.credentials.source.storeId, null);
    assert.equal(conflict.credentials.source.matchesExpected, null);
    for (const check of conflict.database.sourceObjectChecks) {
      assert.deepEqual(check.pathnameLookup, { stage: "locator", outcome: "unexpected-store" });
    }
    console.log("PASS a conflicting canonical host invalidates store identity across pages");

    process.env.BLOB_READ_WRITE_TOKEN = token(otherStore);
    listPage(mock, otherStore, ["rnd/other.webp"]);
    listPage(mock, destinationStore, []);
    for (const asset of assets) read(mock, otherStore, asset, 403);
    const wrongStore = await (await GET()).json();
    assert.equal(wrongStore.credentials.source.storeIdentityVerified, true);
    assert.equal(wrongStore.credentials.source.storeId, "store_" + otherStore);
    assert.equal(wrongStore.credentials.source.matchesExpected, false);
    for (const check of wrongStore.database.sourceObjectChecks) {
      assert.equal(check.listing.exactPathExists, false);
      assert.deepEqual(check.urlLookup, { stage: "get", outcome: "forbidden", status: 403 });
      assert.deepEqual(check.pathnameLookup, { stage: "locator", outcome: "unexpected-store" });
    }
    console.log("PASS wrong-store credential is identified and pathname reads cannot target that store");

    process.env.BLOB_READ_WRITE_TOKEN = token(legacyStore);
    rows = rows.map((row, index) => index === 1 ? { ...row, checksum: "0".repeat(64) } :
      index === 2 ? { ...row, fileSize: row.fileSize - 1 } : row);
    listPage(mock, legacyStore, keys.slice(1));
    listPage(mock, destinationStore, []);
    read(mock, legacyStore, assets[0], 404);
    read(mock, legacyStore, assets[0], 503);
    read(mock, legacyStore, assets[1], 200, 2);
    read(mock, legacyStore, assets[2], 200);
    mock.get(origin(legacyStore)).intercept({
      path: "/" + keys[2], method: "GET", headers: { authorization: "Bearer " + token(legacyStore) },
    }).replyWithError(new Error("synthetic transport failure"));
    const failures = await (await GET()).json();
    const [missing, checksum, size] = failures.database.sourceObjectChecks;
    assert.equal(missing.listing.exactPathExists, false);
    assert.deepEqual(missing.urlLookup, { stage: "get", outcome: "not-found", status: 404 });
    assert.deepEqual(missing.pathnameLookup, { stage: "get", outcome: "http-failure", status: 503 });
    for (const lookup of [checksum.urlLookup, checksum.pathnameLookup]) {
      assert.equal(lookup.outcome, "mismatch");
      assert.equal(lookup.checksumMatches, false);
      assert.equal(lookup.sizeMatches, true);
    }
    assert.equal(size.urlLookup.outcome, "mismatch");
    assert.equal(size.urlLookup.sizeMatches, false);
    assert.equal(size.urlLookup.checksumMatches, true);
    assert.deepEqual(size.pathnameLookup, { stage: "get", outcome: "sdk-or-network", status: null });
    assert.ok(!JSON.stringify(failures).includes("synthetic transport failure"));
    console.log("PASS independent 404, 503 and network outcomes, checksum mismatch and size mismatch");

    rows = assets.map(({ id, storageKey, fileSize, blobUrl, checksum }, index) =>
      ({ id, storageKey, fileSize, blobUrl: index === 0 ? "https://untrusted.invalid/rnd/source.webp" : blobUrl, checksum }));
    listPage(mock, legacyStore, [], { next: "repeated" });
    listPage(mock, legacyStore, [], { cursor: "repeated", next: "repeated" });
    listPage(mock, destinationStore, []);
    read(mock, legacyStore, assets[0], 200);
    for (const asset of assets.slice(1)) read(mock, legacyStore, asset, 200, 2);
    const partial = await (await GET()).json();
    assert.equal(partial.credentials.source.outcome, "invalid-pagination");
    for (const check of partial.database.sourceObjectChecks) assert.equal(check.listing.exactPathExists, null);
    const first = partial.database.sourceObjectChecks[0];
    assert.deepEqual(first.urlLookup, { stage: "locator", outcome: "invalid-locator" });
    assert.equal(first.pathnameLookup.outcome, "verified");
    mock.assertNoPendingInterceptors();
    console.log("PASS incomplete listing preserves unknown membership and an unsafe URL cannot suppress the pathname check");
  } finally {
    for (const key of ["BLOB_READ_WRITE_TOKEN", "RND_BLOB_READ_WRITE_TOKEN", "VERCEL_BLOB_API_URL"]) {
      if (oldEnv[key] === undefined) delete process.env[key];
      else process.env[key] = oldEnv[key];
    }
    setGlobalDispatcher(dispatcher);
    await mock.close();
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
