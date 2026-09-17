import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRndWorker } from "@/lib/rnd/worker-auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    requireRndWorker(request.headers.get("authorization"));
  } catch (response) {
    return response;
  }

  const assetId = new URL(request.url).searchParams.get("assetId");
  if (!assetId) return NextResponse.json({ error: "assetId is required" }, { status: 400 });

  const asset = await prisma.rnDAsset.findUnique({
    where: { id: assetId },
    select: { kind: true, blobUrl: true, mimeType: true, fileSize: true },
  });

  if (!asset) return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  if (asset.kind !== "SOURCE") return NextResponse.json({ error: "Asset is not a source" }, { status: 409 });

  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
  if (!blobToken) return NextResponse.json({ error: "Blob storage is not configured" }, { status: 503 });

  const upstream = await fetch(asset.blobUrl, {
    headers: { Authorization: `Bearer ${blobToken}` },
    cache: "no-store",
  });

  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: "Source asset could not be retrieved" }, { status: 502 });
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "content-type": asset.mimeType,
      "content-length": String(asset.fileSize),
      "cache-control": "private, no-store",
    },
  });
}
