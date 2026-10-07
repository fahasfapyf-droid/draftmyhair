import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { requireRndWorker } from "@/lib/rnd/worker-auth";

export const runtime = "nodejs";

const MAX_ARTIFACT_BYTES = 15 * 1024 * 1024;

export async function POST(request: Request) {
  const authResponse = requireRndWorker(request.headers.get("authorization"));
  if (authResponse) return authResponse;

  const workerId = request.headers.get("x-rnd-worker-id")?.trim() || null;
  const formData = await request.formData().catch(() => null);
  const jobId = typeof formData?.get("jobId") === "string" ? String(formData.get("jobId")) : null;
  const attemptNumberValue = formData?.get("attemptNumber");
  const attemptNumber = typeof attemptNumberValue === "string" ? Number(attemptNumberValue) : NaN;
  const file = formData?.get("file");

  if (!workerId || !jobId || !Number.isInteger(attemptNumber) || attemptNumber < 1 || !(file instanceof File)) return NextResponse.json({ error: "workerId, jobId, attemptNumber and file are required" }, { status: 400 });
  if (!file.type.startsWith("image/")) return NextResponse.json({ error: "Artifact must be an image" }, { status: 415 });
  if (file.size <= 0 || file.size > MAX_ARTIFACT_BYTES) return NextResponse.json({ error: "Artifact size is outside the allowed range" }, { status: 413 });

  const now = new Date();
  const job = await prisma.rnDJob.findUnique({ where: { id: jobId }, select: { id: true, leaseOwner: true, leaseExpiresAt: true, status: true } });
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  if (job.status !== "PROCESSING" || job.leaseOwner !== workerId || (job.leaseExpiresAt && job.leaseExpiresAt < now)) return NextResponse.json({ error: "Job lease is no longer valid" }, { status: 409 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const checksum = createHash("sha256").update(buffer).digest("hex");
  const extension = file.type === "image/jpeg" ? "jpg" : file.type === "image/webp" ? "webp" : "png";
  const storageKey = `rnd/attempts/${jobId}/${attemptNumber}-${checksum}.${extension}`;
  const blob = await put(storageKey, buffer, { access: "private", addRandomSuffix: false, allowOverwrite: true, contentType: file.type });

  const asset = await prisma.rnDAsset.upsert({
    where: { storageKey },
    create: { kind: "GENERATED", storageKey, blobUrl: blob.url, originalFilename: file.name || null, mimeType: file.type, fileSize: file.size, checksum, immutable: true },
    update: {},
    select: { id: true, storageKey: true, blobUrl: true, checksum: true, fileSize: true },
  });

  return NextResponse.json({ ok: true, asset });
}
