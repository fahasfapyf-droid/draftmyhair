import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createHash } from "node:crypto";
import { requireRndBlobToken } from "@/lib/rnd/blob-storage";

export const runtime = "nodejs";
const sha256 = (value: Buffer) => createHash("sha256").update(value).digest("hex");

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const artifactId = new URL(request.url).searchParams.get("artifactId")?.trim();
  if (!artifactId) return NextResponse.json({ error: "artifactId is required" }, { status: 400 });

  const artifact = await prisma.rnDAsset.findUnique({
    where: { id: artifactId },
    select: { id: true, kind: true, blobUrl: true, mimeType: true, fileSize: true, checksum: true },
  });
  if (!artifact || artifact.kind !== "GENERATED" || !artifact.blobUrl || !/^[a-f0-9]{64}$/.test(artifact.checksum ?? "")) {
    return NextResponse.json({ error: "Artifact not found" }, { status: 404 });
  }

  let token: string;
  try {
    token = requireRndBlobToken();
  } catch {
    return NextResponse.json({ error: "R&D Blob storage is not configured" }, { status: 503 });
  }

  try {
    const upstream = await fetch(artifact.blobUrl, {
      redirect: "error",
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
    if (!upstream.ok || !upstream.body) {
      return NextResponse.json({ error: "R&D artifact could not be retrieved" }, { status: 502 });
    }

    const bytes = Buffer.from(await upstream.arrayBuffer());
    if (bytes.length !== artifact.fileSize || sha256(bytes) !== artifact.checksum) {
      return NextResponse.json({ error: "R&D artifact integrity check failed" }, { status: 502 });
    }

    return new Response(bytes, {
      status: 200,
      headers: {
        "Content-Type": artifact.mimeType,
        "Content-Length": String(bytes.length),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": `inline; filename="rnd-${artifact.id}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "R&D artifact could not be retrieved" }, { status: 502 });
  }
}
