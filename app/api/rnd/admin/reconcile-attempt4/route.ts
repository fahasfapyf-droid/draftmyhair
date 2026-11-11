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
const ATTEMPT = 4;
const TARGET_KEY = "rnd-protocol2-italian-bob-fresh-20261110-01";
const SOURCE_CHECKSUM = "d100a15e9731e6532dec84c6e72bdab753084dba93cfe21651a48759a8368d9d";
const EXPECTED_RECOVERED_CHECKSUM = "d764ab74a490940f948992d2b94492a8979451f8cad75626afb2269c8f2b52aa";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (form?.get("jobId") !== JOB_ID || form?.get("attemptNumber") !== String(ATTEMPT) ||
      form?.get("targetKey") !== TARGET_KEY || !(file instanceof File)) {
    return NextResponse.json({ error: "Exact job, attempt, target key and image file confirmation required." }, { status: 400 });
  }
  if (file.type !== "image/jpeg" || file.size <= 0 || file.size > 15 * 1024 * 1024) {
    return NextResponse.json({ error: "Recovered artifact must be a JPEG under 15 MB." }, { status: 415 });
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  const checksum = createHash("sha256").update(buffer).digest("hex");
  if (checksum === SOURCE_CHECKSUM) return NextResponse.json({ code: "RND_SOURCE_IMAGE_CANNOT_BE_ARTIFACT" }, { status: 409 });
  if (checksum !== EXPECTED_RECOVERED_CHECKSUM) return NextResponse.json({ code: "RND_RECOVERED_IMAGE_CHECKSUM_MISMATCH" }, { status: 409 });

  const now = new Date();
  const job = await prisma.rnDJob.findUnique({ where: { id: JOB_ID }, select: {
    status: true, attemptCount: true, leaseExpiresAt: true, startedAt: true, currentPrompt: true,
    target: { select: { targetKey: true, sourceAsset: { select: { checksum: true } } } },
    attempts: { where: { attemptNumber: ATTEMPT }, select: { id: true, prompt: true, promptRevision: true, errorCode: true, artifactId: true, submittedAt: true, generationStartedAt: true, generationCompletedAt: true } },
  } });
  const attempt = job?.attempts[0];
  if (!job || !attempt || job.target.targetKey !== TARGET_KEY || job.target.sourceAsset.checksum !== SOURCE_CHECKSUM ||
      job.status !== "PROCESSING" || job.attemptCount !== ATTEMPT - 1 || !job.leaseExpiresAt ||
      job.leaseExpiresAt > now || !job.startedAt || attempt.prompt !== job.currentPrompt ||
      attempt.promptRevision !== "reserved-v2") {
    return NextResponse.json({ error: "Job claim, prompt, source or attempt fence does not match; no changes made." }, { status: 409 });
  }

  const existingAsset = attempt.artifactId
    ? await prisma.rnDAsset.findUnique({ where: { id: attempt.artifactId }, select: { id: true, kind: true, checksum: true, originalFilename: true } })
    : null;
  const isUncertain = attempt.errorCode === "RND_SUBMISSION_UNCERTAIN" && !attempt.artifactId && !attempt.submittedAt;
  const isRecoveredUncapturedSubmission = ATTEMPT === 4 && attempt.errorCode === "RND_SUBMITTED" && Boolean(attempt.submittedAt) && Boolean(attempt.generationStartedAt) && !attempt.generationCompletedAt && !attempt.artifactId;
  const isKnownWrongSourceAttachment = attempt.errorCode === "RND_SUBMITTED" && Boolean(attempt.submittedAt) &&
    existingAsset?.kind === "GENERATED" && existingAsset.checksum === SOURCE_CHECKSUM;
  if (!isUncertain && !isKnownWrongSourceAttachment && !isRecoveredUncapturedSubmission) {
    return NextResponse.json({ error: "Attempt is not in the exact recoverable submitted-without-artifact state; no changes made." }, { status: 409 });
  }

  const prior = await readPriorRndArtifactChecksums(prisma, JOB_ID, ATTEMPT);
  if (!prior || prior.includes(checksum)) return NextResponse.json({ code: prior ? "RND_DUPLICATE_ARTIFACT" : "RND_PRIOR_ARTIFACT_CHECKSUM_UNAVAILABLE" }, { status: 409 });

  const ext = "jpg";
  const key = `rnd/attempts/${JOB_ID}/${ATTEMPT}-${checksum}-operator-${randomUUID()}.${ext}`;
  const blob = await put(key, buffer, { access: "private", addRandomSuffix: false, contentType: file.type, token: requireRndBlobToken() });
  const workerId = `operator-reconciliation:${session.user.id}`;
  const generation = job.startedAt;
  try {
    const committed = await prisma.$transaction(async tx => {
      const current = await tx.rnDJob.findUnique({ where: { id: JOB_ID }, select: { status: true, attemptCount: true, leaseExpiresAt: true, startedAt: true } });
      const reserved = await tx.rnDAttempt.findUnique({ where: { id: attempt.id }, select: { errorCode: true, artifactId: true, submittedAt: true, generationStartedAt: true, generationCompletedAt: true } });
      if (!current || current.status !== "PROCESSING" || current.attemptCount !== ATTEMPT - 1 ||
          current.startedAt?.getTime() !== generation.getTime() || !current.leaseExpiresAt ||
          current.leaseExpiresAt > new Date() || !reserved) return false;
      const sameUncertain = reserved.errorCode === "RND_SUBMISSION_UNCERTAIN" && !reserved.artifactId && !reserved.submittedAt;
      const sameBadAttachment = isKnownWrongSourceAttachment && reserved.errorCode === "RND_SUBMITTED" &&
        reserved.artifactId === existingAsset?.id && Boolean(reserved.submittedAt);
      const sameRecoveredUncapturedSubmission = isRecoveredUncapturedSubmission && reserved.errorCode === "RND_SUBMITTED" &&
        !reserved.artifactId && Boolean(reserved.submittedAt) && Boolean(reserved.generationStartedAt) && !reserved.generationCompletedAt;
      if (!sameUncertain && !sameBadAttachment && !sameRecoveredUncapturedSubmission) return false;
      const seen = await readPriorRndArtifactChecksums(tx, JOB_ID, ATTEMPT);
      if (!seen || seen.includes(checksum)) return false;
      const asset = await tx.rnDAsset.create({ data: {
        kind: "GENERATED", storageKey: key, blobUrl: blob.url, originalFilename: file.name || "Gemini_Generated_Image.jpg",
        mimeType: file.type, fileSize: file.size, checksum, immutable: true,
      }, select: { id: true } });
      await tx.rnDAttempt.update({ where: { id: attempt.id }, data: {
        artifactId: asset.id, submittedAt: now, generationCompletedAt: now, errorCode: "RND_SUBMITTED",
        errorMessage: isKnownWrongSourceAttachment
          ? "Administrator replaced an incorrectly attached source photo with the checksum-verified recovered Gemini result. Reconciliation timestamps are not original Gemini completion timestamps."
          : "Recovered by administrator from the matching Gemini conversation after worker capture failure. Reconciliation timestamps are not original Gemini completion timestamps.",
      } });
      await tx.rnDJob.update({ where: { id: JOB_ID }, data: { leaseOwner: workerId, leaseExpiresAt: new Date(Date.now() + 300000) } });
      return true;
    });
    if (!committed) {
      await del(blob.url, { token: requireRndBlobToken() }).catch(() => undefined);
      return NextResponse.json({ error: "Reconciliation fence rejected the image." }, { status: 409 });
    }
    const report = await reportRndAttempt(new Request(new URL("/api/rnd/worker/report", request.url), {
      method: "POST", headers: {
        authorization: `Bearer ${process.env.RND_WORKER_TOKEN ?? ""}`,
        "content-type": "application/json",
        "x-rnd-worker-id": workerId,
        ...(process.env.VERCEL_AUTOMATION_BYPASS_SECRET ? { "x-vercel-protection-bypass": process.env.VERCEL_AUTOMATION_BYPASS_SECRET } : {}),
      },
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

