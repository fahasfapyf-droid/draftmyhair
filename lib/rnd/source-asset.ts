import { createHash } from "node:crypto";
import { requireRndBlobToken } from "@/lib/rnd/blob-storage";

const LEGACY_PREVIEW_SOURCE = {
  storageKey: "rnd/sources/d100a15e9731e6532dec84c6e72bdab753084dba93cfe21651a48759a8368d9d-50736ff4-39ac-4cac-be66-9b15704fa1c6.webp",
  checksum: "d100a15e9731e6532dec84c6e72bdab753084dba93cfe21651a48759a8368d9d",
  fileSize: 1_126_530,
  publicPath: "/portfolio/bob/french-bob-before.webp",
};

type RndSourceAsset = {
  storageKey: string;
  blobUrl: string;
  mimeType: string;
  fileSize: number;
  checksum: string | null;
};

export async function fetchRndSourceAsset(
  asset: RndSourceAsset,
  requestUrl: string,
  protectionBypass: string | null,
) {
  const token = requireRndBlobToken();
  let upstream: Response | null = null;

  try {
    upstream = await fetch(asset.blobUrl, {
      redirect: "error",
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    // A narrowly allowlisted legacy Preview fixture may be served below.
  }

  if (upstream?.ok && upstream.body) {
    const buffer = Buffer.from(await upstream.arrayBuffer());
    if (buffer.byteLength !== asset.fileSize || !/^[a-f0-9]{64}$/.test(asset.checksum ?? "") || createHash("sha256").update(buffer).digest("hex") !== asset.checksum) {
      throw new Error("RND_SOURCE_INTEGRITY_MISMATCH");
    }
    return { buffer, mimeType: asset.mimeType };
  }

  const isExactLegacyFixture =
    asset.storageKey === LEGACY_PREVIEW_SOURCE.storageKey &&
    asset.checksum === LEGACY_PREVIEW_SOURCE.checksum &&
    asset.fileSize === LEGACY_PREVIEW_SOURCE.fileSize;

  if (isExactLegacyFixture) {
    const fallbackUrl = new URL(LEGACY_PREVIEW_SOURCE.publicPath, requestUrl);
    const effectiveBypass = protectionBypass ?? process.env.VERCEL_AUTOMATION_BYPASS_SECRET ?? null;
    const headers = effectiveBypass
      ? { "x-vercel-protection-bypass": effectiveBypass }
      : undefined;

    try {
      const fallback = await fetch(fallbackUrl, {
        redirect: "error",
        headers,
        cache: "no-store",
        signal: AbortSignal.timeout(30_000),
      });
      if (fallback.ok) {
        const buffer = Buffer.from(await fallback.arrayBuffer());
        const checksum = createHash("sha256").update(buffer).digest("hex");
        if (buffer.byteLength === asset.fileSize && checksum === asset.checksum) {
          return { buffer, mimeType: asset.mimeType };
        }
      }
    } catch {
      // Return the normal retrieval error below.
    }
  }

  throw new Error("Source asset could not be retrieved.");
}
