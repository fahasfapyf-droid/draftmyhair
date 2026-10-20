import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { put, del } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { requireRndWorker } from "@/lib/rnd/worker-auth";
import { fenceRndReportLease, hasValidRndLeaseExpiry, parseRndClaimGeneration } from "@/lib/rnd/report-lease-fence";

export const runtime = "nodejs";
const MAX_ARTIFACT_BYTES = 15 * 1024 * 1024;

export async function POST(request: Request) {
  const authResponse = requireRndWorker(request.headers.get("authorization"));
  if (authResponse) return authResponse;

  const workerId = request.headers.get("x-rnd-worker-id")?.trim() || "";
  const form = await request.formData().catch(() => null);
  const jobId = typeof form?.get("jobId") === "string" ? String(form.get("jobId")) : "";
  const attemptNumber = Number(form?.get("attemptNumber"));
  const claimGeneration = parseRndClaimGeneration(form?.get("claimGeneration"));
  const image = form?.get("image");

  if (!workerId || !jobId || !Number.isInteger(attemptNumber) || attemptNumber < 1 || !claimGeneration) {
    return NextResponse.json({ error: "worker id, jobId, attemptNumber and claimGeneration are required" }, { status: 400 });
  }
  if (!(image instanceof File) || !image.type.startsWith("image/")) {
    return NextResponse.json({ error: "image must be an image file" }, { status: 400 });
  }
  if (image.size <= 0 || image.size > MAX_ARTIFACT_BYTES) {
    return NextResponse.json({ error: "artifact image size is outside the allowed range" }, { status: 413 });
  }

  const now = new Date();
  const job = await prisma.rnDJob.findUnique({
    where: { id: jobId },
    select: { status: true, leaseOwner: true, leaseExpiresAt: true, startedAt: true, attemptCount: true },
  });
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  if (job.status !== "PROCESSING" || job.leaseOwner !== workerId ||
      !hasValidRndLeaseExpiry(job.leaseExpiresAt, now) ||
      job.startedAt?.getTime() !== claimGeneration.getTime() ||
      job.attemptCount !== attemptNumber - 1) {
    return NextResponse.json({ error: "Job lease or claim generation is no longer valid" }, { status: 409 });
  }

  const reservation = await prisma.rnDAttempt.findUnique({
    where: { jobId_attemptNumber: { jobId, attemptNumber } },
    select: { id: true, artifactId: true },
  });
  if (!reservation) return NextResponse.json({ error: "Attempt reservation not found" }, { status: 409 });
  if (reservation.artifactId) {
    return NextResponse.json({ ok: true, artifactId: reservation.artifactId, idempotent: true });
  }

  const bytes = Buffer.from(await image.arrayBuffer());
  const extension = image.type === "image/jpeg" ? "jpg" : image.type === "image/webp" ? "webp" : "png";
  const storageKey = `rnd/generated/${jobId}/attempt-${attemptNumber}-${randomUUID()}.${extension}`;
  const blob = await put(storageKey, bytes, { access: "private", addRandomSuffix: false, contentType: image.type });

  try {
    const artifact = await prisma.$transaction(async (tx) => {
      const valid = await fenceRndReportLease(tx, {
        jobId, workerId, claimStartedAt: claimGeneration,
        expectedAttemptCount: attemptNumber - 1, attemptId: reservation.id, attemptNumber,
      });
      if (!valid) return null;
      const existing = await tx.rnDAttempt.findUnique({ where: { id: reservation.id }, select: { artifactId: true } });
      if (existing?.artifactId) return { id: existing.artifactId, reused: true };
      const created = await tx.rnDAsset.create({
        data: { kind: "GENERATED", storageKey, blobUrl: blob.url, originalFilename: image.name || null,
          mimeType: image.type, fileSize: image.size, immutable: true },
        select: { id: true },
      });
      await tx.rnDAttempt.update({ where: { id: reservation.id }, data: { artifactId: created.id } });
      return { id: created.id, reused: false };
    });
    if (!artifact || artifact.reused) {
      await del(blob.url).catch(() => undefined);
      if (!artifact) return NextResponse.json({ error: "Job lease or claim generation changed before upload commit" }, { status: 409 });
      return NextResponse.json({ ok: true, artifactId: artifact.id, idempotent: true });
    }
    return NextResponse.json({ ok: true, artifactId: artifact.id });
  } catch (error) {
    await del(blob.url).catch(() => undefined);
    throw error;
  }
}
