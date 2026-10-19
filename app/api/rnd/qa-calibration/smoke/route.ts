import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireRndWorker } from "@/lib/rnd/worker-auth";
import {
  GET as readCalibration,
  POST as submitCalibration,
} from "@/app/api/rnd/qa-calibration/route";
import {
  buildCalibrationSamples,
  summarizeCalibration,
} from "@/lib/rnd/qa-calibration";

export const runtime = "nodejs";
export const maxDuration = 30;

function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export async function GET(request: Request) {
  if (process.env.VERCEL_ENV !== "preview") {
    return json({ error: "Not found." }, 404);
  }

  if (!process.env.RND_WORKER_TOKEN?.trim()) {
    process.env.RND_WORKER_TOKEN = "qa-calibration-smoke-" + crypto.randomUUID();
  }
  const internalToken = process.env.RND_WORKER_TOKEN.trim();

  const suffix = `qa-calibration-smoke-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let assetId: string | null = null;
  let campaignId: string | null = null;
  let targetId: string | null = null;
  let jobId: string | null = null;
  let attemptId: string | null = null;

  try {
    const asset = await prisma.rnDAsset.create({
      data: {
        kind: "SOURCE",
        storageKey: `rnd-smoke/${suffix}/source.webp`,
        blobUrl: `https://smoke.invalid/${suffix}/source.webp`,
        mimeType: "image/webp",
        fileSize: 1,
        width: 1,
        height: 1,
        immutable: true,
      },
      select: { id: true },
    });
    assetId = asset.id;

    const campaign = await prisma.rnDCampaign.create({
      data: {
        name: `QA CALIBRATION SMOKE ${suffix}`,
        createdByUserId: "system-smoke",
      },
      select: { id: true },
    });
    campaignId = campaign.id;

    const target = await prisma.rnDTarget.create({
      data: {
        campaignId: campaign.id,
        targetType: "SINGLE",
        targetKey: suffix,
        hardCoreInstruction: "Synthetic calibration smoke sample.",
        sourceAssetId: asset.id,
        status: "HUMAN_APPROVAL",
      },
      select: { id: true },
    });
    targetId = target.id;

    const job = await prisma.rnDJob.create({
      data: {
        targetId: target.id,
        status: "HUMAN_APPROVAL",
        currentPrompt: "Synthetic calibration smoke prompt.",
        attemptCount: 1,
      },
      select: { id: true },
    });
    jobId = job.id;

    const attempt = await prisma.rnDAttempt.create({
      data: {
        jobId: job.id,
        attemptNumber: 1,
        prompt: "Synthetic calibration smoke prompt.",
        promptRevision: "smoke",
        submittedAt: new Date(),
        artifactId: null,
        overallScore: 9.7,
        aiGatePassed: true,
        publicationTierPassed: true,
        verdict: "HUMAN_APPROVAL",
      },
      select: { id: true },
    });
    attemptId = attempt.id;

    const auth = `Bearer ${internalToken}`;
    const humanScores = [9.4, 9.6, 9.5];
    const hairstyleScores = [9.2, 9.4, 9.3];

    for (let i = 0; i < 3; i += 1) {
      const response = await submitCalibration(
        new Request("https://internal/api/rnd/qa-calibration", {
          method: "POST",
          headers: {
            authorization: auth,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            attemptId,
            reviewerKey: `smoke-reviewer-${i + 1}`,
            humanOverallScore: humanScores[i],
            humanHairstyleScore: hairstyleScores[i],
            notes: "Synthetic smoke-test rating; deleted before response.",
          }),
        }),
      );
      assert(response.status === 201, `Calibration POST failed with status ${response.status}.`);
      const payload = await response.json();
      assert(JSON.stringify(payload) === JSON.stringify({ ok: true }), "Reviewer response exposed unexpected calibration data.");
    }

    const calibrationResponse = await readCalibration(
      new Request("https://internal/api/rnd/qa-calibration", {
        headers: { authorization: auth },
      }),
    );
    assert(calibrationResponse.status === 200, `Calibration GET failed with status ${calibrationResponse.status}.`);

    const calibration = await calibrationResponse.json();
    const sample = calibration.samples?.find((item: { attemptId: string }) => item.attemptId === attemptId);
    assert(sample, "Synthetic calibration sample was not returned.");
    assert(sample.reviewerCount === 3, "Calibration sample did not enforce the three-reviewer minimum.");
    assert(sample.humanOverallScore === 9.5, `Unexpected human median: ${sample.humanOverallScore}.`);
    assert(sample.humanHairstyleScore === 9.3, `Unexpected hairstyle median: ${sample.humanHairstyleScore}.`);
    assert(sample.aiOverallScore === 9.7, `Unexpected AI score: ${sample.aiOverallScore}.`);

    const pureSamples = [
      { attemptId: "fp-1", humanOverallScore: 9.4, humanHairstyleScore: 9.4, reviewerCount: 3, aiOverallScore: 9.6 },
      { attemptId: "fp-2", humanOverallScore: 9.2, humanHairstyleScore: 9.2, reviewerCount: 3, aiOverallScore: 9.7 },
      { attemptId: "pass-1", humanOverallScore: 9.6, humanHairstyleScore: 9.6, reviewerCount: 3, aiOverallScore: 9.7 },
    ];
    const summary = summarizeCalibration(pureSamples, { minSamples: 1, maxFalsePassRate: 0.5, minCorrelation: -1 });
    assert(summary.falsePassCount === 2, `Unexpected false-pass count: ${summary.falsePassCount}.`);
    assert(summary.falsePassRate === 1, `Unexpected false-pass rate: ${summary.falsePassRate}.`);

    const zeroScoreSamples = buildCalibrationSamples(
      [
        { attemptId: "zero", reviewerKey: "a", humanOverallScore: 0, humanHairstyleScore: 0 },
        { attemptId: "zero", reviewerKey: "b", humanOverallScore: 0, humanHairstyleScore: 0 },
        { attemptId: "zero", reviewerKey: "c", humanOverallScore: 0, humanHairstyleScore: 0 },
      ],
      new Map([["zero", 0]]),
      3,
    );
    assert(zeroScoreSamples[0]?.humanHairstyleScore === 0, "Zero-valued hairstyle scores must not be converted to null.");

    return json({
      ok: true,
      endpointRoundTrip: {
        reviewerCount: sample.reviewerCount,
        humanOverallMedian: sample.humanOverallScore,
        humanHairstyleMedian: sample.humanHairstyleScore,
        aiOverallScore: sample.aiOverallScore,
        reviewerResponse: { ok: true },
      },
      mathChecks: {
        falsePassCount: summary.falsePassCount,
        falsePassRate: summary.falsePassRate,
        zeroScorePreserved: true,
      },
      cleanup: "Synthetic calibration records are deleted before the response.",
    });
  } catch (error) {
    return json({
      ok: false,
      error: error instanceof Error ? error.message : "Calibration smoke test failed.",
    }, 500);
  } finally {
    if (attemptId) await prisma.rnDQAReferenceRating.deleteMany({ where: { attemptId } });
    if (attemptId) await prisma.rnDAttempt.deleteMany({ where: { id: attemptId } });
    if (jobId) await prisma.rnDJob.deleteMany({ where: { id: jobId } });
    if (targetId) await prisma.rnDTarget.deleteMany({ where: { id: targetId } });
    if (campaignId) await prisma.rnDCampaign.deleteMany({ where: { id: campaignId } });
    if (assetId) await prisma.rnDAsset.deleteMany({ where: { id: assetId } });
  }
}
