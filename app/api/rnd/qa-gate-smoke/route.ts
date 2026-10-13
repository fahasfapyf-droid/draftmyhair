import { NextResponse } from "next/server";
import { randomUUID, createHash } from "node:crypto";
import { del, put } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { QA_GATE_FIXTURE_BASE64 } from "./fixture";
import { POST as reportWorker, GET as readWorkerReport } from "@/app/api/rnd/worker/report/route";

export const runtime = "nodejs";
export const maxDuration = 180;

export async function GET() {
  if (process.env.VERCEL_ENV !== "preview" || process.env.VERCEL_GIT_COMMIT_REF !== "rnd/qa-gate-clean-integration") {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const internalAuth = "Bearer " + (process.env.RND_WORKER_TOKEN ?? "");
  if (internalAuth === "Bearer ") {
    return NextResponse.json({ error: "Preview worker credential is not configured." }, { status: 503 });
  }

  const suffix = randomUUID();
  const workerId = "qa-gate-smoke-" + suffix;
  const prompt = "Transform only the hair into a clearly visible vivid emerald-green mohawk with fully shaved sides. Preserve the face, skin, ears, head geometry, lighting, background, framing, and every non-hair region exactly.";
  const storagePrefix = "rnd/qa-gate-smoke/" + suffix;
  let sourceBlobUrl: string | null = null;
  let generatedBlobUrl: string | null = null;
  let sourceAssetId: string | null = null;
  let generatedAssetId: string | null = null;
  let campaignId: string | null = null;
  let targetId: string | null = null;
  let jobId: string | null = null;
  let attemptId: string | null = null;

  try {
    const image = Buffer.from(QA_GATE_FIXTURE_BASE64, "base64");
    const checksum = createHash("sha256").update(image).digest("hex");
    const [sourceBlob, generatedBlob] = await Promise.all([
      put(storagePrefix + "/source.webp", image, { access: "private", addRandomSuffix: false, contentType: "image/webp" }),
      put(storagePrefix + "/generated.webp", image, { access: "private", addRandomSuffix: false, contentType: "image/webp" }),
    ]);
    sourceBlobUrl = sourceBlob.url;
    generatedBlobUrl = generatedBlob.url;

    const sourceAsset = await prisma.rnDAsset.create({
      data: { kind: "SOURCE", storageKey: storagePrefix + "/source.webp", blobUrl: sourceBlob.url, originalFilename: "qa-gate-smoke-source.webp", mimeType: "image/webp", fileSize: image.length, checksum, immutable: true },
      select: { id: true },
    });
    sourceAssetId = sourceAsset.id;
    const generatedAsset = await prisma.rnDAsset.create({
      data: { kind: "GENERATED", storageKey: storagePrefix + "/generated.webp", blobUrl: generatedBlob.url, originalFilename: "qa-gate-smoke-generated.webp", mimeType: "image/webp", fileSize: image.length, checksum, immutable: true },
      select: { id: true },
    });
    generatedAssetId = generatedAsset.id;

    const campaign = await prisma.rnDCampaign.create({
      data: { name: "Disposable QA gate route smoke " + suffix, createdByUserId: "system-qa-gate-smoke" },
      select: { id: true },
    });
    campaignId = campaign.id;
    const target = await prisma.rnDTarget.create({
      data: { campaignId: campaign.id, targetType: "SINGLE", targetKey: suffix, hardCoreInstruction: prompt, sourceAssetId: sourceAsset.id, status: "PROCESSING" },
      select: { id: true },
    });
    targetId = target.id;
    const now = new Date();
    const job = await prisma.rnDJob.create({
      data: { targetId: target.id, status: "PROCESSING", currentPrompt: prompt, attemptCount: 0, leaseOwner: workerId, leaseExpiresAt: new Date(now.getTime() + 5 * 60_000), heartbeatAt: now, startedAt: now },
      select: { id: true },
    });
    jobId = job.id;
    await prisma.rnDTarget.update({ where: { id: target.id }, data: { currentJobId: job.id } });
    const attempt = await prisma.rnDAttempt.create({
      data: { jobId: job.id, attemptNumber: 1, prompt, promptRevision: "qa-gate-smoke", submittedAt: now, generationStartedAt: now, verdict: "REFINE" },
      select: { id: true },
    });
    attemptId = attempt.id;

    const reportResponse = await reportWorker(new Request("https://internal/api/rnd/worker/report", {
      method: "POST",
      headers: { authorization: internalAuth, "x-rnd-worker-id": workerId, "content-type": "application/json" },
      body: JSON.stringify({ jobId: job.id, attemptNumber: 1, prompt, promptRevision: "qa-gate-smoke", submittedAt: now.toISOString(), generationStartedAt: now.toISOString(), generationCompletedAt: new Date().toISOString(), artifactId: generatedAsset.id }),
    }));
    const reportPayload = await reportResponse.json().catch(() => ({})) as Record<string, any>;
    const persisted = await prisma.rnDAttempt.findUnique({
      where: { jobId_attemptNumber: { jobId: job.id, attemptNumber: 1 } },
      select: { verdict: true, aiGatePassed: true, publicationTierPassed: true, qaJson: true },
    });
    const jobAfter = await prisma.rnDJob.findUnique({ where: { id: job.id }, select: { status: true } });
    const candidateResponse = await readWorkerReport(new Request("https://internal/api/rnd/worker/report?jobId=" + job.id, { headers: { authorization: internalAuth } }));
    const candidatePayload = await candidateResponse.json().catch(() => ({})) as Record<string, any>;
    const isRejected = reportResponse.ok &&
      reportPayload.action !== "HUMAN_APPROVAL" &&
      jobAfter?.status !== "HUMAN_APPROVAL" &&
      persisted?.verdict !== "HUMAN_APPROVAL" &&
      persisted?.aiGatePassed !== true &&
      persisted?.publicationTierPassed !== true &&
      candidatePayload.bestCandidate == null;

    return NextResponse.json({
      ok: isRejected,
      test: "same-image negative QA through the actual report handler",
      reportHttpStatus: reportResponse.status,
      reportAction: reportPayload.action ?? null,
      persistedVerdict: persisted?.verdict ?? null,
      aiGatePassed: persisted?.aiGatePassed ?? null,
      publicationTierPassed: persisted?.publicationTierPassed ?? null,
      jobStatus: jobAfter?.status ?? null,
      candidateReturned: candidatePayload.bestCandidate != null,
      firstEvaluator: reportPayload.qa ? {
        verdict: reportPayload.qa.verdict,
        overall: reportPayload.qa.overall,
        identity: reportPayload.qa.identity,
        styleAccuracy: reportPayload.qa.styleAccuracy,
        rootIntegration: reportPayload.qa.rootIntegration,
        lightingConsistency: reportPayload.qa.lightingConsistency,
        hairOnly: reportPayload.qa.hairOnly,
        artifacts: reportPayload.qa.artifacts,
      } : null,
      note: "No image generation was run; source bytes were reused as the generated artifact.",
    }, { status: isRejected ? 200 : 500 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "QA gate route smoke failed." }, { status: 500 });
  } finally {
    if (attemptId) await prisma.rnDQAReferenceRating.deleteMany({ where: { attemptId } }).catch(() => {});
    if (attemptId) await prisma.rnDAttempt.deleteMany({ where: { id: attemptId } }).catch(() => {});
    if (jobId) await prisma.rnDJob.deleteMany({ where: { id: jobId } }).catch(() => {});
    if (targetId) await prisma.rnDTarget.deleteMany({ where: { id: targetId } }).catch(() => {});
    if (campaignId) await prisma.rnDCampaign.deleteMany({ where: { id: campaignId } }).catch(() => {});
    if (generatedAssetId) await prisma.rnDAsset.deleteMany({ where: { id: generatedAssetId } }).catch(() => {});
    if (sourceAssetId) await prisma.rnDAsset.deleteMany({ where: { id: sourceAssetId } }).catch(() => {});
    const urls = [sourceBlobUrl, generatedBlobUrl].filter((url): url is string => Boolean(url));
    if (urls.length) await del(urls).catch(() => {});
  }
}
