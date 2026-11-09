import { createHash } from "node:crypto";
import { get, list } from "@vercel/blob";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sourceToken = process.env.BLOB_READ_WRITE_TOKEN?.trim() ?? "";
  const destinationToken = process.env.RND_BLOB_READ_WRITE_TOKEN?.trim() ?? "";
  const sourceStoreId = process.env.BLOB_STORE_ID?.trim() ?? "";
  const destinationStoreId = process.env.BLOB_READ_WRITE_TOKEN_STORE_ID?.trim() ?? "";

  async function listProbe(token: string, prefix?: string) {
    if (!token) return { configured: false, accepted: false, count: 0 };
    try {
      const result = await list({ limit: 1000, ...(prefix ? { prefix } : {}), token });
      return { configured: true, accepted: true, count: result.blobs.length, hasMore: result.hasMore };
    } catch {
      return { configured: true, accepted: false, count: 0 };
    }
  }

  const [sourceList, destinationList] = await Promise.all([
    listProbe(sourceToken),
    listProbe(destinationToken, "rnd/"),
  ]);

  const assets = await prisma.rnDAsset.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, blobUrl: true, fileSize: true, checksum: true },
  });

  const sourceObjectChecks = [];
  if (sourceToken && assets.length === 3) {
    for (const asset of assets) {
      try {
        const object = await get(asset.blobUrl, { access: "private", token: sourceToken });
        if (!object || object.statusCode !== 200) {
          sourceObjectChecks.push({ assetId: asset.id, readable: false, checksumMatches: false, sizeMatches: false });
          continue;
        }
        const bytes = Buffer.from(await new Response(object.stream).arrayBuffer());
        const checksum = createHash("sha256").update(bytes).digest("hex");
        sourceObjectChecks.push({
          assetId: asset.id,
          readable: true,
          checksumMatches: checksum === asset.checksum,
          sizeMatches: bytes.length === asset.fileSize,
          size: bytes.length,
          sourceHost: new URL(asset.blobUrl).hostname,
        });
      } catch {
        sourceObjectChecks.push({ assetId: asset.id, readable: false, checksumMatches: false, sizeMatches: false });
      }
    }
  }

  return NextResponse.json({
    ok: true,
    credentials: {
      source: { ...sourceList, storeId: sourceStoreId || null },
      destination: { ...destinationList, storeId: destinationStoreId || null },
      distinct: Boolean(sourceToken && destinationToken && sourceToken !== destinationToken),
    },
    database: {
      expectedLegacyAssetCount: 3,
      assetCount: assets.length,
      sourceObjectChecks,
    },
    expected: {
      sourceStoreId: "store_ZjSA3cZUbKwe6YuA",
      destinationStoreId: "store_ErwFOk17AEWS4n1e",
    },
    note: "Read-only verification. No Blob objects or database records were modified.",
  }, { headers: { "Cache-Control": "no-store" } });
}
