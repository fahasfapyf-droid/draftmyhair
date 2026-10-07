import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const artifactId = new URL(request.url).searchParams.get("artifactId");
  if (!artifactId) return NextResponse.json({ error: "artifactId is required" }, { status: 400 });

  const artifact = await prisma.rnDAsset.findUnique({
    where: { id: artifactId },
    select: { id: true, kind: true, blobUrl: true, mimeType: true, fileSize: true },
  });
  if (!artifact || artifact.kind !== "GENERATED") return NextResponse.json({ error: "Artifact not found" }, { status: 404 });

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return NextResponse.json({ error: "Blob storage is not configured" }, { status: 503 });

  const upstream = await fetch(artifact.blobUrl, {
    headers: { Authorization: "Bearer " + token },
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });
  if (!upstream.ok) return NextResponse.json({ error: "Artifact could not be retrieved" }, { status: 502 });

  return new Response(await upstream.arrayBuffer(), {
    status: 200,
    headers: {
      "Content-Type": artifact.mimeType,
      "Content-Length": String(artifact.fileSize),
      "Cache-Control": "private, no-store",
      "Content-Disposition": `inline; filename="rnd-${artifact.id}"`,
    },
  });
}
