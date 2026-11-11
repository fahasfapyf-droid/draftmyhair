import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createHash, randomUUID } from "node:crypto";
import { put, del } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { requireRndBlobToken } from "@/lib/rnd/blob-storage";
import { readPriorRndArtifactChecksums } from "@/lib/rnd/artifact-checksums";
import { POST as reportRndAttempt } from "../../worker/report/route";

export const runtime = "nodejs";
const JOB_ID = "rndproto2-italian-bob-20261110-a3";
const ATTEMPT = 3;
const TARGET_KEY = "rnd-protocol2-italian-bob-fresh-20261110-01";
const SOURCE_CHECKSUM = "d100a15e9731e6532dec84c6e72bdab753084dba93cfe21651a48759a8368d9d";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (form?.get("jobId") !== JOB_ID || form?.get("attemptNumber") !== String(ATTEMPT) ||
      form?.get("targetKey") !== TARGET_KEY || !(file instanceof File)) {
    return NextResponse.json({ error: "Exact job, attempt, target key and image file confirmation required." }, { status: 400 });
  }
  if (!file.type.startsWith("image/") || file.size <= 0 || file.size > 15 * 1024 * 1024) {
    return NextResponse.json({ error: "Invalid image type or size." }, { status: 415 });
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  const checksum = createHash("sha256").update(buffer).digest("hex");
  const now = new Date();
  const job = await prisma.rnDJob.findUnique({ where: { id: JOB_ID }, select: {
    status: true, attemptCount: true, leaseExpiresAt: true, startedAt: true, currentPrompt: true,
    target: { select: { targetKey: true, sourceAsset: { select: { checksum: true } } } },
    attempts: { where: { attemptNumber: ATTEMPT }, select: { id: true, prompt: true, promptRevision: true, errorCode: true, artifactId: true, submittedAt: true, generationStartedAt: true } },
  } });
  const attempt = job?.attempts[0];
  if (!job || !attempt || job.target.targetKey !== TARGET_KEY || job.target.sourceAsset.checksum !== SOURCE_CHECKSUM ||
      job.status !== "PROCESSING" || job.attemptCount !== ATTEMPT - 1 || !job.leaseExpiresAt ||
      job.leaseExpiresAt > now || !job.startedAt || attempt.prompt !== job.currentPrompt ||
      attempt.promptRevision !== "reserved-v2" || attempt.errorCode !== "RND_SUBMISSION_UNCERTAIN" ||
      attempt.artifactId || attempt.submittedAt) {
    return NextResponse.json({ error: "Expected uncertain attempt state not found; no changes made." }, { status: 409 });
  }
  const prior = await readPriorRndArtifactChecksums(prisma, JOB_ID, ATTEMPT);
  if (!prior || prior.includes(checksum)) return NextResponse.json({ code: prior ? "RND_DUPLICATE_ARTIFACT" : "RND_PRIOR_ARTIFACT_CHECKSUM_UNAVAILABLE" }, { status: 409 });

  const ext = file.type === "image/jpeg" ? "jpg" : file.type === "image/webp" ? "webp" : "png";
  const key = `rnd/attempts/${JOB_ID}/${ATTEMPT}-${checksum}-operator-${randomUUID()}.${ext}`;
  const blob = await put(key, buffer, { access: "private", addRandomSuffix: false, contentType: file.type, token: requireRndBlobToken() });
  const workerId = `operator-reconciliation:${session.user.id}`;
  const generation = job.startedAt;
  try {
    const committed = await prisma.$transaction(async tx => {
      const current = await tx.rnDJob.findUnique({ where: { id: JOB_ID }, select: { status: true, attemptCount: true, leaseExpiresAt: true, startedAt: true } });
      const reserved = await tx.rnDAttempt.findUnique({ where: { id: attempt.id }, select: { errorCode: true, artifactId: true, submittedAt: true } });
      if (!current || current.status !== "PROCESSING" || current.attemptCount !== ATTEMPT - 1 ||
          current.startedAt?.getTime() !== generation.getTime() || !current.leaseExpiresAt ||
          current.leaseExpiresAt > new Date() || !reserved || reserved.errorCode !== "RND_SUBMISSION_UNCERTAIN" ||
          reserved.artifactId || reserved.submittedAt) return false;
      const seen = await readPriorRndArtifactChecksums(tx, JOB_ID, ATTEMPT);
      if (!seen || seen.includes(checksum)) return false;
      const asset = await tx.rnDAsset.create({ data: {
        kind: "GENERATED", storageKey: key, blobUrl: blob.url, originalFilename: file.name || "recovered-gemini-image",
        mimeType: file.type, fileSize: file.size, checksum, immutable: true,
      }, select: { id: true } });
      await tx.rnDAttempt.update({ where: { id: attempt.id }, data: {
        artifactId: asset.id, submittedAt: now, generationCompletedAt: now, errorCode: "RND_SUBMITTED",
        errorMessage: "Recovered by administrator from Gemini after uncertain worker capture. submittedAt and generationCompletedAt record reconciliation time, not original generation time.",
      } });
      await tx.rnDJob.update({ where: { id: JOB_ID }, data: { leaseOwner: workerId, leaseExpiresAt: new Date(Date.now() + 300000) } });
      return true;
    });
    if (!committed) {
      await del(blob.url, { token: requireRndBlobToken() }).catch(() => undefined);
      return NextResponse.json({ error: "Reconciliation fence rejected the image." }, { status: 409 });
    }
    const report = await reportRndAttempt(new Request("https://internal.local/api/rnd/worker/report", {
      method: "POST", headers: { authorization: `Bearer ${process.env.RND_WORKER_TOKEN ?? ""}`,
        "content-type": "application/json", "x-rnd-worker-id": workerId },
      body: JSON.stringify({ jobId: JOB_ID, attemptNumber: ATTEMPT, claimGeneration: generation.toISOString(),
        generationStartedAt: attempt.generationStartedAt?.toISOString(), generationCompletedAt: now.toISOString(),
        artifactId: (await prisma.rnDAttempt.findUnique({ where: { id: attempt.id }, select: { artifactId: true } }))?.artifactId }),
    }));
    const result = await report.json().catch(() => null);
    return NextResponse.json({ ok: report.ok, reconciled: true, checksum, qa: result }, { status: report.ok ? 200 : 202 });
  } catch (error) {
    console.error("Operator R&D reconciliation failed after Blob upload.", error);
    return NextResponse.json({ error: "Outcome uncertain; preserve the artifact and inspect the attempt before retrying." }, { status: 500 });
  }
}
