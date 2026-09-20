import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { put } from "@vercel/blob";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
const MAX_SOURCE_BYTES = 15 * 1024 * 1024;

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sources = await prisma.rnDAsset.findMany({
    where: { kind: "SOURCE" },
    orderBy: { createdAt: "desc" },
    select: { id: true, originalFilename: true, displayName: true, genderPresentation: true, cohortLabel: true, hairTexture: true, hairLength: true, notes: true, mimeType: true, fileSize: true, width: true, height: true, createdAt: true },
  });
  return NextResponse.json({ sources }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const form = await request.formData().catch(() => null);
  const image = form?.get("image");
  if (!(image instanceof File) || !image.type.startsWith("image/")) return NextResponse.json({ error: "image must be an image file" }, { status: 400 });
  if (image.size <= 0 || image.size > MAX_SOURCE_BYTES) return NextResponse.json({ error: "source image size is outside the allowed range" }, { status: 413 });
  const text = (key: string) => { const value = form?.get(key); return typeof value === "string" ? value.trim().slice(0, 200) : ""; };
  const buffer = Buffer.from(await image.arrayBuffer());
  const checksum = createHash("sha256").update(buffer).digest("hex");
  const extension = image.type === "image/jpeg" ? "jpg" : image.type === "image/webp" ? "webp" : "png";
  const storageKey = "rnd/sources/" + checksum + "." + extension;
  const existing = await prisma.rnDAsset.findUnique({ where: { storageKey } });
  if (existing) return NextResponse.json({ ok: true, source: existing, reused: true });
  const blob = await put(storageKey, buffer, { access: "private", addRandomSuffix: false, contentType: image.type });
  const source = await prisma.rnDAsset.create({
    data: {
      kind: "SOURCE", storageKey, blobUrl: blob.url, originalFilename: image.name || null, mimeType: image.type,
      fileSize: image.size, checksum, displayName: text("displayName") || image.name || null,
      genderPresentation: text("genderPresentation") || null, cohortLabel: text("cohortLabel") || null,
      hairTexture: text("hairTexture") || null, hairLength: text("hairLength") || null,
      notes: text("notes") || null, immutable: true,
    },
  });
  return NextResponse.json({ ok: true, source });
}
