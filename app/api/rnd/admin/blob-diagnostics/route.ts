import { createHash } from "node:crypto";
import { get, list } from "@vercel/blob";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const maxDuration = 60;

const LEGACY_STORE_ID = "ZjSA3cZUbKwe6YuA";
const DESTINATION_STORE_ID = "ErwFOk17AEWS4n1e";
const PRIVATE_SUFFIX = ".private.blob.vercel-storage.com";
const LEGACY_HOST = LEGACY_STORE_ID.toLowerCase() + PRIVATE_SUFFIX;
const EXPECTED_ASSET_COUNT = 3;
const NO_STORE = { "Cache-Control": "no-store" };
const ASSET_FIELDS = { id: true, storageKey: true, blobUrl: true, fileSize: true, checksum: true } as const;

type Asset = { id: string; storageKey: string; blobUrl: string; fileSize: number; checksum: string | null };
type ReadOutcome =
  | { stage: "locator"; outcome: "invalid-locator" | "unexpected-store" | "not-configured" }
  | { stage: "get"; outcome: "forbidden" | "not-found" | "http-failure"; status: number }
  | { stage: "get" | "download"; outcome: "sdk-or-network"; status: number | null }
  | { stage: "integrity"; outcome: "verified" | "mismatch"; status: 200; size: number;
      sizeMatches: boolean; checksumMatches: boolean };

function tokenStoreId(token: string) {
  // SDK 2.6.1 uses this store component for explicit read-write credentials.
  return /^vercel_blob_rw_([a-zA-Z0-9]+)_\S+$/.exec(token)?.[1] ?? null;
}

function privateBlobUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol === "https:" && url.hostname.endsWith(PRIVATE_SUFFIX) &&
        !url.username && !url.password && !url.port && !url.search && !url.hash) return url;
  } catch {
    // A malformed stored URL must not prevent the independent pathname probe.
  }
  return null;
}

function rndPath(value: string) {
  return /^rnd\/(?:[\w-]+\/)*[\w.-]+$/.test(value) && !value.split("/").some((part) => part === "." || part === "..");
}

async function listSource(token: string, keys: string[], signal: AbortSignal) {
  const matched = new Map<string, { host: string | null; urlPathMatches: boolean }>();
  const cursors = new Set<string>();
  const expectedStoreId = tokenStoreId(token);
  const expectedHost = expectedStoreId ? expectedStoreId.toLowerCase() + PRIVATE_SUFFIX : null;
  let observedHost: string | null = null;
  let conflictingHosts = false;
  let cursor: string | undefined;
  let pages = 0;
  let count = 0;
  let hasMore = false;
  let outcome: "complete" | "keys-found" | "not-configured" | "sdk-or-network" | "invalid-pagination" = "not-configured";

  if (token) {
    try {
      do {
        const page = await list({ token, prefix: "rnd/", limit: 1000, cursor, abortSignal: signal });
        pages++;
        count += page.blobs.length;
        hasMore = page.hasMore;
        for (const blob of page.blobs) {
          const url = privateBlobUrl(blob.url);
          const host = url?.hostname ?? null;
          if (host && observedHost && host !== observedHost) conflictingHosts = true;
          if (host && expectedHost && host !== expectedHost) conflictingHosts = true;
          observedHost ??= host;
          if (keys.includes(blob.pathname)) {
            matched.set(blob.pathname, { host, urlPathMatches: url?.pathname === "/" + blob.pathname });
          }
        }
        if (!hasMore) { outcome = "complete"; break; }
        if (keys.length > 0 && keys.every((key) => matched.has(key))) { outcome = "keys-found"; break; }
        cursor = page.cursor;
        if (!cursor || cursors.has(cursor)) { outcome = "invalid-pagination"; break; }
        cursors.add(cursor);
      } while (true);
    } catch {
      outcome = "sdk-or-network";
    }
  }

  // The token is only a hint. A canonical URL from the authenticated listing
  // must corroborate it before the store identity can be reported.
  const storeIdentityVerified = expectedStoreId !== null && observedHost !== null &&
    observedHost === expectedHost && !conflictingHosts;
  const authenticatedStoreId = storeIdentityVerified ? "store_" + expectedStoreId : null;
  const matchesExpected = storeIdentityVerified ? observedHost === LEGACY_HOST : null;
  return {
    matched,
    summary: {
      configured: Boolean(token), accepted: pages > 0, stage: "source-list", outcome, pages, count, hasMore,
      storeIdentityVerified, storeId: authenticatedStoreId, observedHost, conflictingHosts, matchesExpected,
    },
  };
}

async function listDestination(token: string, signal: AbortSignal) {
  if (!token) return { configured: false, accepted: false, stage: "destination-list", outcome: "not-configured" };
  try {
    const page = await list({ token, prefix: "rnd/", limit: 1000, abortSignal: signal });
    return { configured: true, accepted: true, stage: "destination-list", outcome: "listed",
      count: page.blobs.length, hasMore: page.hasMore };
  } catch {
    return { configured: true, accepted: false, stage: "destination-list", outcome: "sdk-or-network" };
  }
}

function httpFailure(status: number): ReadOutcome {
  return { stage: "get", outcome: status === 403 ? "forbidden" : status === 404 ? "not-found" : "http-failure", status };
}

async function checkObject(locator: string, asset: Asset, token: string, signal: AbortSignal): Promise<ReadOutcome> {
  let object: Awaited<ReturnType<typeof get>>;
  try {
    object = await get(locator, { access: "private", token, abortSignal: signal });
  } catch (error) {
    // SDK 2.6.1 exposes HTTP failures through this message. Return only the
    // status number, never the message, URL, request headers or credential.
    const status = error instanceof Error ? /^Vercel Blob: Failed to fetch blob: ([1-5]\d{2})(?:\s|$)/.exec(error.message)?.[1] : null;
    return status ? httpFailure(Number(status)) : { stage: "get", outcome: "sdk-or-network", status: null };
  }
  if (!object) return httpFailure(404);
  if (object.statusCode !== 200) return httpFailure(object.statusCode);
  try {
    const hash = createHash("sha256");
    const reader = object.stream.getReader();
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      hash.update(value);
    }
    const sizeMatches = size === asset.fileSize;
    const checksumMatches = hash.digest("hex") === asset.checksum;
    return { stage: "integrity", outcome: sizeMatches && checksumMatches ? "verified" : "mismatch",
      status: 200, size, sizeMatches, checksumMatches };
  } catch {
    return { stage: "download", outcome: "sdk-or-network", status: 200 };
  }
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
  }

  const sourceToken = process.env.BLOB_READ_WRITE_TOKEN?.trim() ?? "";
  const destinationToken = process.env.RND_BLOB_READ_WRITE_TOKEN?.trim() ?? "";
  let assets: Asset[];
  try {
    assets = await prisma.rnDAsset.findMany({ orderBy: { createdAt: "asc" }, select: ASSET_FIELDS, take: EXPECTED_ASSET_COUNT + 1 });
  } catch {
    return NextResponse.json({ ok: false, stage: "database", outcome: "read-failed" }, { status: 502, headers: NO_STORE });
  }
  if (assets.length !== EXPECTED_ASSET_COUNT) {
    return NextResponse.json({ ok: false, stage: "database", outcome: "unexpected-asset-count",
      expectedAssetCount: EXPECTED_ASSET_COUNT, observedAssetCount: assets.length,
      observedCountIsLowerBound: assets.length > EXPECTED_ASSET_COUNT }, { status: 409, headers: NO_STORE });
  }

  const listSignal = AbortSignal.timeout(25_000);
  const [source, destination] = await Promise.all([
    listSource(sourceToken, assets.map((asset) => asset.storageKey), listSignal),
    listDestination(destinationToken, listSignal),
  ]);

  const readSignal = AbortSignal.timeout(20_000);
  // A pathname delegates host selection to the SDK, so never probe one with
  // a credential that would direct the read outside the legacy store.
  const pathnameAllowed = tokenStoreId(sourceToken)?.toLowerCase() === LEGACY_STORE_ID.toLowerCase() &&
    !source.summary.conflictingHosts;
  const sourceObjectChecks = await Promise.all(assets.map(async (asset) => {
    const listed = source.matched.get(asset.storageKey);
    const storedUrl = privateBlobUrl(asset.blobUrl);
    const urlPathMatchesKey = storedUrl?.pathname === "/" + asset.storageKey;
    const validLegacyUrl = storedUrl?.hostname === LEGACY_HOST && rndPath(storedUrl.pathname.slice(1));
    const [urlLookup, pathnameLookup] = await Promise.all<ReadOutcome>([
      !sourceToken ? { stage: "locator", outcome: "not-configured" } :
        validLegacyUrl ? checkObject(storedUrl.href, asset, sourceToken, readSignal) :
          { stage: "locator", outcome: "invalid-locator" },
      !sourceToken ? { stage: "locator", outcome: "not-configured" } :
        !pathnameAllowed ? { stage: "locator", outcome: "unexpected-store" } :
          rndPath(asset.storageKey) ? checkObject(asset.storageKey, asset, sourceToken, readSignal) :
            { stage: "locator", outcome: "invalid-locator" },
    ]);
    return {
      assetId: asset.id, storageKey: asset.storageKey, urlPathMatchesKey,
      listing: {
        stage: "source-list", exactPathExists: listed ? true : source.summary.outcome === "complete" ? false : null,
        canonicalHost: listed?.host ?? null, canonicalUrlPathMatchesKey: listed?.urlPathMatches ?? null,
      },
      urlLookup, pathnameLookup,
    };
  }));

  return NextResponse.json({
    ok: true,
    credentials: {
      source: source.summary, destination,
      distinct: Boolean(sourceToken && destinationToken && sourceToken !== destinationToken),
    },
    database: { expectedLegacyAssetCount: EXPECTED_ASSET_COUNT, assetCount: assets.length, sourceObjectChecks },
    expected: { sourceStoreId: "store_" + LEGACY_STORE_ID, destinationStoreId: "store_" + DESTINATION_STORE_ID },
  }, { headers: NO_STORE });
}
