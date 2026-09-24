import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { put } from "@vercel/blob";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { buildRndPrompt } from "@/lib/rnd/prompt";

const SOURCE_URL =
  "https://www.draftmyhair.com/portfolio/bob/french-bob-before.webp";
const PROMPT_KEY = "italian-bob";
const SOURCE_MAX_BYTES = 15 * 1024 * 1024;

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") return null;
  return session;
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const jobs = await prisma.rnDJob.findMany({
    orderBy: { queuedAt: "desc" },
    take: 20,
    select: {
      id: true,
      status: true,
      attemptCount: true,
      promptVersionNumber: true,
      queuedAt: true,
      nextEligibleAt: true,
      target: {
        select: {
          targetKey: true,
          status: true,
          hairstyleId: true,
          campaign: { select: { name: true } },
        },
      },
      attempts: {
        orderBy: { attemptNumber: "desc" },
        take: 2,
        select: {
          attemptNumber: true,
          verdict: true,
          overallScore: true,
          aiGatePassed: true,
          refinementSlot: true,
          refinementReason: true,
          qaJson: true,
        },
      },
    },
  });

  return NextResponse.json({ jobs });
}

export async function POST() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const built = await buildRndPrompt({ promptKey: PROMPT_KEY });

  const response = await fetch(SOURCE_URL, {
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    return NextResponse.json(
      { error: "Regression source image could not be fetched." },
      { status: 502 }
    );
  }

  const mimeType =
    response.headers.get("content-type")?.split(";")[0]?.trim() || "image/webp";
  if (!mimeType.startsWith("image/")) {
    return NextResponse.json({ error: "Regression source is not an image." }, { status: 415 });
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.length || buffer.length > SOURCE_MAX_BYTES) {
    return NextResponse.json({ error: "Regression source size is outside the allowed range." }, { status: 413 });
  }

  const checksum = createHash("sha256").update(buffer).digest("hex");
  const extension =
    mimeType === "image/jpeg" ? "jpg" : mimeType === "image/png" ? "png" : "webp";
  const storageKey = `rnd/sources/${checksum}.${extension}`;

  const existingSource = await prisma.rnDAsset.findUnique({
    where: { storageKey },
    select: { id: true, blobUrl: true, mimeType: true, fileSize: true, checksum: true },
  });

  const blob =
    !existingSource?.blobUrl
      ? await put(storageKey, buffer, {
          access: "private",
          addRandomSuffix: false,
          contentType: mimeType,
        })
      : null;

  const targetKey = `regression-italian-bob-universal-refinement-${Date.now()}`;

  const result = await prisma.$transaction(async (tx) => {
    const campaign = await tx.rnDCampaign.create({
      data: {
        name: "Universal refinement regression — Italian Bob",
        status: "RUNNING",
        autoAdvanceEnabled: true,
        createdByUserId: session.user.id,
      },
    });

    const source = await tx.rnDAsset.upsert({
      where: { storageKey },
      create: {
        kind: "SOURCE",
        storageKey,
        blobUrl: blob?.url ?? existingSource?.blobUrl ?? "",
        originalFilename: "french-bob-before.webp",
        mimeType,
        fileSize: buffer.length,
        checksum,
        immutable: true,
      },
      update: {},
    });

    const hairstyle = await tx.hairstyle.findFirst({
      where: { promptKey: PROMPT_KEY, isActive: true },
      select: { id: true },
    });

    if (!hairstyle) throw new Error("Active italian-bob hairstyle record not found.");

    const target = await tx.rnDTarget.create({
      data: {
        campaignId: campaign.id,
        targetType: "SINGLE",
        targetKey,
        hairstyleId: hairstyle.id,
        sourceAssetId: source.id,
        status: "QUEUED",
      },
    });

    const job = await tx.rnDJob.create({
      data: {
        targetId: target.id,
        status: "QUEUED",
        promptVersionNumber: 1,
        currentPrompt: built.prompt,
        attemptCount: 0,
        queuedAt: new Date(),
      },
    });

    return { campaign, target, job };
  });

  return NextResponse.json({
    ok: true,
    jobId: result.job.id,
    targetId: result.target.id,
    campaignId: result.campaign.id,
    targetKey,
    promptKey: PROMPT_KEY,
    promptDiagnostics: built.diagnostics,
  });
}
