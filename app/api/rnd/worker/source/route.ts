import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRndWorker } from "@/lib/rnd/worker-auth";
import { fetchRndSourceAsset } from "@/lib/rnd/source-asset";

export const runtime = "nodejs";

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

  try {
    const source = await fetchRndSourceAsset(
      asset,
      request.url,
      request.headers.get("x-vercel-protection-bypass"),
    );
    return new Response(source.buffer, {
      status: 200,
      headers: {
        "content-type": source.mimeType,
        "content-length": String(source.buffer.byteLength),
        "cache-control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "Source asset could not be retrieved" }, { status: 502 });
  }
}
