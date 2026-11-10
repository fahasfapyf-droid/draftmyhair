import { NextResponse } from "next/server";
import { createHash, randomUUID } from "node:crypto";
import { put, del } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { requireRndBlobToken } from "@/lib/rnd/blob-storage";
import { requireRndWorker } from "@/lib/rnd/worker-auth";
import { fenceRndReportLease, hasValidRndLeaseExpiry, parseRndClaimGeneration } from "@/lib/rnd/report-lease-fence";

export const runtime = "nodejs";
const MAX_ARTIFACT_BYTES = 15 * 1024 * 1024;

export async function POST(request: Request) {
  const authResponse = requireRndWorker(request.headers.get("authorization"));
  if (authResponse) return authResponse;

  const workerId = request.headers.get("x-rnd-worker-id")?.trim() || "";
  const formData = await request.formData().catch(() => null);
  const jobId = typeof formData?.get("jobId") === "string" ? String(formData.get("jobId")) : "";
  const attemptNumberValue = formData?.get("attemptNumber");
  const attemptNumber = typeof attemptNumberValue === "string" ? Number(attemptNumberValue) : NaN;
  const claimGeneration = parseRndClaimGeneration(formData?.get("claimGeneration"));
  const file = formData?.get("file") ?? formData?.get("image");

  if (!workerId || !jobId || !Number.isInteger(attemptNumber) || attemptNumber < 1 ||
      !claimGeneration || !(file instanceof File)) {
    return NextResponse.json({ error: "workerId, jobId, attemptNumber, claimGeneration and file are required" }, { status: 400 });
  }
  if (!file.type.startsWith("image/")) return NextResponse.json({ error: "Artifact must be an image" }, { status: 415 });
  if (file.size <= 0 || file.size > MAX_ARTIFACT_BYTES) return NextResponse.json({ error: "Artifact size is outside the allowed range" }, { status: 413 });

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

  const attempt = await prisma.rnDAttempt.findUnique({
    where: { jobId_attemptNumber: { jobId, attemptNumber } },
    select: { id: true, errorCode: true },
  });
  if (attempt?.errorCode !== "RND_SUBMITTED") return NextResponse.json({ code: "RND_SUBMISSION_NOT_RECORDED" }, { status: 409 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const checksum = createHash("sha256").update(buffer).digest("hex");
  const extension = file.type === "image/jpeg" ? "jpg" : file.type === "image/webp" ? "webp" : "png";
  // Unique object key prevents a stale upload from overwriting an earlier artifact.
  const storageKey = `rnd/attempts/${jobId}/${attemptNumber}-${checksum}-${randomUUID()}.${extension}`;
  const blob = await put(storageKey, buffer, { access: "private", addRandomSuffix: false, contentType: file.type, token: requireRndBlobToken() });

  // An exception may leave the commit outcome unknown. Preserve the object for reconciliation.
  const result = await prisma.$transaction(async (tx) => {
    const valid = await fenceRndReportLease(tx, {
      jobId, workerId, claimStartedAt: claimGeneration,
      expectedAttemptCount: attemptNumber - 1, attemptId: attempt.id, attemptNumber,
    });
    if (!valid) return null;
    const recorded = await tx.rnDAttempt.findUnique({
      where: { id: attempt.id }, select: { errorCode: true, artifact: {
        select: { id: true, storageKey: true, blobUrl: true, checksum: true, fileSize: true },
      } },
    });
    if (recorded?.errorCode !== "RND_SUBMITTED") return null;
    if (recorded.artifact) return recorded.artifact.checksum === checksum ? { asset: recorded.artifact, reused: true } : null;
    const asset = await tx.rnDAsset.create({
      data: { kind: "GENERATED", storageKey, blobUrl: blob.url, originalFilename: file.name || null,
        mimeType: file.type, fileSize: file.size, checksum, immutable: true },
      select: { id: true, storageKey: true, blobUrl: true, checksum: true, fileSize: true },
    });
    await tx.rnDAttempt.update({ where: { id: attempt.id }, data: { artifactId: asset.id, generationCompletedAt: new Date() } });
    return { asset, reused: false };
  });
  if (!result || result.reused) {
    await del(blob.url, { token: requireRndBlobToken() }).catch(() => undefined);
    if (!result) return NextResponse.json({ error: "Job lease or claim generation changed before upload commit" }, { status: 409 });
  }
  return NextResponse.json({ ok: true, asset: result.asset, artifactId: result.asset.id, idempotent: result.reused });
}
