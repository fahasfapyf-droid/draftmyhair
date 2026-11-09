import { createHash } from "node:crypto";
import { get, list, put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireRndBlobToken } from "@/lib/rnd/blob-storage";

export const runtime = "nodejs";
export const maxDuration = 60;

const LEGACY_STORE_HOST = "zjsa3czubkwe6yua.private.blob.vercel-storage.com";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sourceToken = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  const destinationToken = requireRndBlobToken();
  if (!sourceToken || sourceToken === destinationToken) {
    return NextResponse.json({ error: "Separate legacy and R&D Blob credentials are required" }, { status: 503 });
  }

  const assets = await prisma.rnDAsset.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, storageKey: true, blobUrl: true, mimeType: true, fileSize: true, checksum: true },
  });
  if (assets.length !== 3) {
    return NextResponse.json({ error: "Unexpected R&D asset count; refusing migration", assetCount: assets.length }, { status: 409 });
  }

  for (const asset of assets) {
    if (!asset.checksum || !asset.blobUrl || new URL(asset.blobUrl).hostname !== LEGACY_STORE_HOST) {
      return NextResponse.json({ error: "Asset does not match the expected legacy store", assetId: asset.id }, { status: 409 });
    }
  }

  const expectedKeys = new Set(assets.map((asset) => asset.storageKey));
  const existing = await list({ prefix: "rnd/", limit: 1000, token: destinationToken });
  if (existing.hasMore || existing.blobs.some((blob) => !expectedKeys.has(blob.pathname))) {
    return NextResponse.json({ error: "Destination store contains unexpected R&D objects; refusing migration" }, { status: 409 });
  }

  const migrated: Array<{ id: string; url: string; checksum: string; size: number }> = [];
  for (const asset of assets) {
    const already = existing.blobs.find((blob) => blob.pathname === asset.storageKey);
    let bytes: Buffer;

    if (already) {
      const stored = await get(asset.storageKey, { access: "private", token: destinationToken });
      if (!stored || stored.statusCode !== 200) {
        return NextResponse.json({ error: "Existing destination object cannot be verified", assetId: asset.id }, { status: 502 });
      }
      bytes = Buffer.from(await new Response(stored.stream).arrayBuffer());
    } else {
      const source = await get(asset.blobUrl, { access: "private", token: sourceToken });
      if (!source || source.statusCode !== 200) {
        return NextResponse.json({ error: "Legacy source object cannot be read", assetId: asset.id }, { status: 502 });
      }
      bytes = Buffer.from(await new Response(source.stream).arrayBuffer());
      const sourceChecksum = createHash("sha256").update(bytes).digest("hex");
      if (bytes.length !== asset.fileSize || sourceChecksum !== asset.checksum) {
        return NextResponse.json({ error: "Legacy source integrity check failed", assetId: asset.id }, { status: 409 });
      }
      await put(asset.storageKey, bytes, {
        access: "private",
        addRandomSuffix: false,
        allowOverwrite: false,
        contentType: asset.mimeType,
        token: destinationToken,
      });
    }

    const checksum = createHash("sha256").update(bytes).digest("hex");
    if (bytes.length !== asset.fileSize || checksum !== asset.checksum) {
      return NextResponse.json({ error: "Destination integrity check failed", assetId: asset.id }, { status: 409 });
    }

    const verified = await get(asset.storageKey, { access: "private", token: destinationToken });
    if (!verified || verified.statusCode !== 200 || verified.blob.size !== asset.fileSize) {
      return NextResponse.json({ error: "Destination read-back verification failed", assetId: asset.id }, { status: 502 });
    }
    const readBack = Buffer.from(await new Response(verified.stream).arrayBuffer());
    const readBackChecksum = createHash("sha256").update(readBack).digest("hex");
    if (readBackChecksum !== asset.checksum || readBack.length !== asset.fileSize) {
      return NextResponse.json({ error: "Destination read-back checksum mismatch", assetId: asset.id }, { status: 409 });
    }

    const destinationUrl = verified.blob.url;
    migrated.push({ id: asset.id, url: destinationUrl, checksum, size: bytes.length });
  }

  await prisma.$transaction(
    migrated.map((asset) => prisma.rnDAsset.update({
      where: { id: asset.id },
      data: { blobUrl: asset.url },
    })),
  );

  return NextResponse.json({
    ok: true,
    migratedCount: migrated.length,
    assets: migrated.map(({ id, checksum, size }) => ({ id, checksum, size })),
    sourceObjectsPreserved: true,
    destinationStore: "dmh-rnd-artifacts",
  }, { headers: { "Cache-Control": "no-store" } });
}
