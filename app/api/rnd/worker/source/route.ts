import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRndWorker } from "@/lib/rnd/worker-auth";
import { requireRndBlobToken } from "@/lib/rnd/blob-storage";

export const runtime = "nodejs";

// This isolated Preview fixture predates the dedicated R&D Blob store. Its
// byte-identical public portfolio source is retained in the deployment while
// the legacy private-store credential is unavailable. Keep this allowlist
// checksum-bound; do not broaden it into a general public-URL fallback.
const LEGACY_PREVIEW_SOURCE = {
  storageKey: "rnd/sources/d100a15e9731e6532dec84c6e72bdab753084dba93cfe21651a48759a8368d9d-50736ff4-39ac-4cac-be66-9b15704fa1c6.webp",
  checksum: "d100a15e9731e6532dec84c6e72bdab753084dba93cfe21651a48759a8368d9d",
  fileSize: 1_126_530,
  publicPath: "/portfolio/bob/french-bob-before.webp",
};

export async function GET(request: Request) {
  const authResponse = requireRndWorker(request.headers.get("authorization"));
  if (authResponse) return authResponse;

  const assetId = new URL(request.url).searchParams.get("assetId");
  if (!assetId) return NextResponse.json({ error: "assetId is required" }, { status: 400 });
  const asset = await prisma.rnDAsset.findUnique({
    where: { id: assetId },
    select: { kind: true, blobUrl: true, mimeType: true, fileSize: true, checksum: true, storageKey: true },
  });
  if (!asset) return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  if (asset.kind !== "SOURCE") return NextResponse.json({ error: "Asset is not a source" }, { status: 409 });

  const blobToken = requireRndBlobToken();
  let upstream: Response | null = null;
  try {
    upstream = await fetch(asset.blobUrl, {
      headers: { Authorization: `Bearer ${blobToken}` },
      cache: "no-store",
    });
  } catch {
    // A narrowly allowlisted legacy Preview fixture may be served below.
  }

  if (upstream?.ok && upstream.body) {
    return new Response(upstream.body, {
      status: 200,
      headers: {
        "content-type": asset.mimeType,
        "content-length": String(asset.fileSize),
        "cache-control": "private, no-store",
      },
    });
  }

  const isExactLegacyFixture =
    asset.storageKey === LEGACY_PREVIEW_SOURCE.storageKey &&
    asset.checksum === LEGACY_PREVIEW_SOURCE.checksum &&
    asset.fileSize === LEGACY_PREVIEW_SOURCE.fileSize;

  if (isExactLegacyFixture) {
    const fallbackUrl = new URL(LEGACY_PREVIEW_SOURCE.publicPath, request.url);
    const bypass = request.headers.get("x-vercel-protection-bypass");
    const headers = bypass ? { "x-vercel-protection-bypass": bypass } : undefined;

    try {
      const fallback = await fetch(fallbackUrl, { headers, cache: "no-store" });
      if (fallback.ok) {
        const bytes = new Uint8Array(await fallback.arrayBuffer());
        const checksum = createHash("sha256").update(bytes).digest("hex");
        if (bytes.byteLength === asset.fileSize && checksum === asset.checksum) {
          return new Response(bytes, {
            status: 200,
            headers: {
              "content-type": asset.mimeType,
              "content-length": String(bytes.byteLength),
              "cache-control": "private, no-store",
            },
          });
        }
      }
    } catch {
      // Return the normal source retrieval error below.
    }
  }

  return NextResponse.json({ error: "Source asset could not be retrieved" }, { status: 502 });
}
