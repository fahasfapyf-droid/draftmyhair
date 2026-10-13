import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRndWorker } from "@/lib/rnd/worker-auth";

export const runtime = "nodejs";
const MAX_RND_ATTEMPTS = 40;

export async function GET(request: Request) {
  const unauthorized = requireRndWorker(request.headers.get("authorization"));
  if (unauthorized) return unauthorized;

  const now = new Date();
  const [jobCounts, assetCounts, candidates] = await Promise.all([
    prisma.rnDJob.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.rnDAsset.groupBy({ by: ["kind"], _count: { _all: true } }),
    prisma.rnDJob.findMany({
      where: {
        status: "QUEUED",
        attemptCount: { lt: MAX_RND_ATTEMPTS },
        OR: [{ nextEligibleAt: null }, { nextEligibleAt: { lte: now } }],
      },
      orderBy: [{ queuedAt: "asc" }, { id: "asc" }],
      take: 10,
      select: {
        id: true, status: true, attemptCount: true, currentPrompt: true,
        nextEligibleAt: true, queuedAt: true,
        target: {
          select: {
            id: true, targetKey: true, status: true,
            campaign: { select: { name: true, status: true, autoAdvanceEnabled: true } },
            sourceAsset: {
              select: { id: true, kind: true, blobUrl: true, mimeType: true, fileSize: true, checksum: true, immutable: true },
            },
          },
        },
        attempts: { orderBy: { attemptNumber: "desc" }, take: 3, select: { attemptNumber: true, verdict: true, artifactId: true } },
      },
    }),
  ]);

  const db = process.env.DATABASE_URL;
  let databaseHost: string | null = null;
  let databaseName: string | null = null;
  try {
    if (db) {
      const parsed = new URL(db);
      databaseHost = parsed.hostname;
      databaseName = parsed.pathname.replace(/^\//, "");
    }
  } catch {}

  return NextResponse.json({
    ok: true,
    readOnly: true,
    checkedAt: now.toISOString(),
    database: { configured: Boolean(db), parseable: Boolean(databaseHost), host: databaseHost, name: databaseName },
    dependencies: {
      workerTokenConfigured: Boolean(process.env.RND_WORKER_TOKEN?.trim()),
      privateBlobTokenConfigured: Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim()),
      vertexProjectConfigured: Boolean(process.env.GOOGLE_CLOUD_PROJECT_ID?.trim()),
      vertexLocationConfigured: Boolean(process.env.GOOGLE_CLOUD_LOCATION?.trim()),
      vertexCredentialsConfigured: Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim()),
      qaModel: process.env.RND_QA_MODEL ?? "gemini-2.5-flash",
      finalQaModel: process.env.RND_FINAL_QA_MODEL ?? "gemini-2.5-pro",
      maxAttempts: MAX_RND_ATTEMPTS,
    },
    jobCounts: jobCounts.map((row) => ({ status: row.status, count: row._count._all })),
    assetCounts: assetCounts.map((row) => ({ kind: row.kind, count: row._count._all })),
    eligibleQueuedCandidates: candidates.map((job) => ({
      jobId: job.id,
      status: job.status,
      attemptCount: job.attemptCount,
      nextAttemptNumber: job.attemptCount + 1,
      remainingAttemptsAtServerCeiling: MAX_RND_ATTEMPTS - job.attemptCount,
      promptPresent: Boolean(job.currentPrompt?.trim()),
      promptLength: job.currentPrompt?.length ?? 0,
      targetId: job.target.id,
      targetKey: job.target.targetKey,
      targetStatus: job.target.status,
      campaignName: job.target.campaign.name,
      campaignStatus: job.target.campaign.status,
      autoAdvanceEnabled: job.target.campaign.autoAdvanceEnabled,
      sourceAsset: {
        id: job.target.sourceAsset.id,
        kind: job.target.sourceAsset.kind,
        privateBlobUrlPresent: Boolean(job.target.sourceAsset.blobUrl),
        mimeType: job.target.sourceAsset.mimeType,
        fileSize: job.target.sourceAsset.fileSize,
        checksumPresent: Boolean(job.target.sourceAsset.checksum),
        checksumLength: job.target.sourceAsset.checksum?.length ?? 0,
        immutable: job.target.sourceAsset.immutable,
      },
      recentAttempts: job.attempts,
    })),
  }, { headers: { "Cache-Control": "no-store" } });
}
