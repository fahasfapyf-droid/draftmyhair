import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { requireRndWorker } from "@/lib/rnd/worker-auth";

export const runtime = "nodejs";
const MAX_ARTIFACT_BYTES = 15 * 1024 * 1024;

export async function POST(request: Request) {
  const authResponse = requireRndWorker(request.headers.get("authorization"));
  if (authResponse) return authResponse;

  const workerId = request.headers.get("x-rnd-worker-id")?.trim() || "";
  const form = await request.formData().catch(() => null);
  const jobId = typeof form?.get("jobId") === "string" ? String(form?.get("jobId")) : "";
  const attemptNumber = Number(form?.get("attemptNumber"));
  const image = form?.get("image");

  if (!workerId || !jobId || !Number.isInteger(attemptNumber) || attemptNumber < 1) {
    return NextResponse.json({ error: "worker id, jobId and attemptNumber are required" }, { status: 400 });
  }
  if (!(image instanceof File) || !image.type.startsWith("image/")) {
    return NextResponse.json({ error: "image must be an image file" }, { status: 400 });
  }
  if (image.size <= 0 || image.size > MAX_ARTIFACT_BYTES) {
    return NextResponse.json({ error: "artifact image size is outside the allowed range" }, { status: 413 });
  }

  const job = await prisma.rnDJob.findUnique({
    where: { id: jobId },
    select: { id: true, targetId: true, status: true, leaseOwner: true, leaseExpiresAt: true },
  });
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  if (job.status !== "PROCESSING" || job.leaseOwner !== workerId || (job.leaseExpiresAt && job.leaseExpiresAt < new Date())) {
    return NextResponse.json({ error: "Job lease is no longer valid" }, { status: 409 });
  }

  const existing = await prisma.rnDAttempt.findUnique({
    where: { jobId_attemptNumber: { jobId, attemptNumber } },
    select: { artifactId: true },
  });
  if (!existing) return NextResponse.json({ error: "Attempt reservation not found" }, { status: 409 });
  if (existing.artifactId) return NextResponse.json({ ok: true, artifactId: existing.artifactId, idempotent: true });

  const buffer = Buffer.from(await image.arrayBuffer());
  const extension = image.type === "image/jpeg" ? "jpg" : image.type === "image/webp" ? "webp" : "png";
  const storageKey = "rnd/generated/" + jobId + "/attempt-" + attemptNumber + "." + extension;
  const blob = await put(storageKey, buffer, { access: "private", addRandomSuffix: false, contentType: image.type });

  const artifact = await prisma.rnDAsset.create({
    data: {
      kind: "GENERATED",
      storageKey,
      blobUrl: blob.url,
      originalFilename: image.name || null,
      mimeType: image.type,
      fileSize: image.size,
      immutable: true,
    },
    select: { id: true, blobUrl: true, mimeType: true, fileSize: true },
  });

  await prisma.rnDAttempt.update({
    where: { jobId_attemptNumber: { jobId, attemptNumber } },
    data: { artifactId: artifact.id },
  });

  return NextResponse.json({ ok: true, artifact });
}
