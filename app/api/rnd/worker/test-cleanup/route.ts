import { NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { requireRndWorker } from "@/lib/rnd/worker-auth";

export const runtime = "nodejs";
const TEST_TARGET_PREFIX = "task3-approval-fence-fixture-";
const TEST_CAMPAIGN_NAME = "R&D Task 3 approval-fence regression fixture";

export async function POST(request: Request) {
  const auth = requireRndWorker(request.headers.get("authorization"));
  if (auth) return auth;
  const body = await request.json().catch(() => null) as { campaignId?: unknown } | null;
  const campaignId = typeof body?.campaignId === "string" ? body.campaignId.trim() : "";
  if (!campaignId) return NextResponse.json({ error: "campaignId is required" }, { status: 400 });

  const fixture = await prisma.rnDCampaign.findUnique({
    where: { id: campaignId },
    select: { id: true, name: true, createdByUserId: true, targets: { select: { id: true, targetKey: true, sourceAssetId: true, jobs: { select: { id: true, attempts: { select: { id: true, artifactId: true } } } } } } },
  });
  if (!fixture) return NextResponse.json({ ok: true, deleted: false, reason: "not-found" });
  if (fixture.name !== TEST_CAMPAIGN_NAME || fixture.createdByUserId !== "task3-regression-fixture" || fixture.targets.length === 0 || fixture.targets.some((target) => !target.targetKey.startsWith(TEST_TARGET_PREFIX))) {
    return NextResponse.json({ error: "Refusing cleanup: campaign does not match the Task 3 fixture signature" }, { status: 409 });
  }

  const assetIds = new Set<string>();
  const deletedBlobUrls: string[] = [];
  for (const target of fixture.targets) {
    assetIds.add(target.sourceAssetId);
    for (const job of target.jobs) for (const attempt of job.attempts) if (attempt.artifactId) assetIds.add(attempt.artifactId);
  }
  const assets = await prisma.rnDAsset.findMany({ where: { id: { in: [...assetIds] } }, select: { id: true, blobUrl: true } });

  await prisma.$transaction(async (tx) => {
    const jobIds = fixture.targets.flatMap((target) => target.jobs.map((job) => job.id));
    if (jobIds.length) await tx.rnDAttempt.deleteMany({ where: { jobId: { in: jobIds } } });
    if (jobIds.length) await tx.rnDJob.deleteMany({ where: { id: { in: jobIds } } });
    await tx.rnDTarget.deleteMany({ where: { campaignId: fixture.id } });
    await tx.rnDCampaign.delete({ where: { id: fixture.id } });
    for (const asset of assets) {
      const [targetUse, attemptUse] = await Promise.all([
        tx.rnDTarget.count({ where: { sourceAssetId: asset.id } }),
        tx.rnDAttempt.count({ where: { artifactId: asset.id } }),
      ]);
      if (targetUse === 0 && attemptUse === 0) {
        await tx.rnDAsset.delete({ where: { id: asset.id } });
        deletedBlobUrls.push(asset.blobUrl);
      }
    }
  });

  const blobResults = await Promise.allSettled(deletedBlobUrls.map((url) => del(url)));
  return NextResponse.json({ ok: true, deleted: true, databaseRecordsDeleted: true, blobDeletesSucceeded: blobResults.filter((result) => result.status === "fulfilled").length, blobDeleteFailures: blobResults.filter((result) => result.status === "rejected").length });
}
