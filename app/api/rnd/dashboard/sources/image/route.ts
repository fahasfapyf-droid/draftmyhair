import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = new URL(request.url).searchParams.get("assetId");
  if (!id) return NextResponse.json({ error: "assetId is required" }, { status: 400 });
  const source = await prisma.rnDAsset.findUnique({ where: { id }, select: { kind: true, blobUrl: true, mimeType: true, fileSize: true } });
  if (!source || source.kind !== "SOURCE") return NextResponse.json({ error: "Source photo not found" }, { status: 404 });
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return NextResponse.json({ error: "Blob storage is not configured" }, { status: 503 });
  const upstream = await fetch(source.blobUrl, { headers: { Authorization: "Bearer " + token }, cache: "no-store", signal: AbortSignal.timeout(30_000) });
  if (!upstream.ok) return NextResponse.json({ error: "Source photo could not be retrieved" }, { status: 502 });
  return new Response(await upstream.arrayBuffer(), { status: 200, headers: { "Content-Type": source.mimeType, "Content-Length": String(source.fileSize), "Cache-Control": "private, no-store" } });
}
