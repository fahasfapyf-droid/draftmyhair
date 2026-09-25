import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { generateAutonomousPrompt } from "@/lib/rnd/autonomous-prompt";

export const runtime = "nodejs";

const SOURCE_URL = "https://www.draftmyhair.com/portfolio/bob/french-bob-before.webp";
const STYLE_KEYS = ["italian-bob", "blunt-lob", "soft-layered-bob"];

function json(value: unknown, status = 200) {
  return NextResponse.json(value, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: Request) {
  if (process.env.VERCEL_ENV === "production") return json({ error: "Preview-only R&D smoke route." }, 404);

  const url = new URL(request.url);
  const campaignId = url.searchParams.get("campaignId")?.trim();

  if (campaignId) {
    const campaign = await prisma.rnDCampaign.findUnique({
      where: { id: campaignId },
      select: {
        id: true,
        name: true,
        status: true,
        autoAdvanceEnabled: true,
        targets: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            targetKey: true,
            status: true,
            currentJobId: true,
            hairstyleId: true,
            job: {
              select: {
                id: true,
                status: true,
                attemptCount: true,
                queuedAt: true,
                startedAt: true,
                completedAt: true,
                failureCode: true,
                failureMessage: true,
                attempts: {
                  orderBy: { attemptNumber: "asc" },
                  select: {
                    attemptNumber: true,
                    verdict: true,
                    overallScore: true,
                    aiGatePassed: true,
                    publicationTierPassed: true,
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!campaign) return json({ error: "Campaign not found" }, 404);
    return json({ ok: true, campaign });
  }

  const admin = await prisma.user.findFirst({
    where: { isActive: true, isDeleted: false, role: "ADMIN" },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  if (!admin) return json({ error: "No active admin user available" }, 503);

  const sourceResponse = await fetch(SOURCE_URL, { cache: "no-store", signal: AbortSignal.timeout(30_000) });
  if (!sourceResponse.ok) return json({ error: `Source fetch failed: HTTP ${sourceResponse.status}` }, 502);
  const mimeType = sourceResponse.headers.get("content-type")?.split(";")[0]?.trim() || "image/webp";
  const buffer = Buffer.from(await sourceResponse.arrayBuffer());
  if (!mimeType.startsWith("image/") || !buffer.length) return json({ error: "Invalid source image" }, 502);

  const checksum = createHash("sha256").update(buffer).digest("hex");
  const extension = mimeType === "image/jpeg" ? "jpg" : mimeType === "image/png" ? "png" : "webp";
  const storageKey = "rnd/smoke-sources/" + checksum + "." + extension;
  const existing = await prisma.rnDAsset.findUnique({
    where: { storageKey },
    select: { id: true, blobUrl: true, mimeType: true, fileSize: true, checksum: true },
  });
  const blob = existing?.blobUrl
    ? null
    : await put(storageKey, buffer, { access: "private", addRandomSuffix: false, contentType: mimeType });

  const styles = await prisma.hairstyle.findMany({
    where: { isActive: true, promptKey: { in: STYLE_KEYS } },
    select: { id: true, name: true, slug: true, promptKey: true, serviceType: true },
  });
  if (styles.length !== STYLE_KEYS.length) {
    return json({ error: "Required smoke-test styles are missing", requested: STYLE_KEYS, found: styles.map((s) => s.promptKey) }, 503);
  }

  const built = await Promise.all(styles.map(async (style) => ({
    style,
    prompt: await generateAutonomousPrompt(
      "Develop a production-quality " + style.name + " hairstyle transformation. This is a controlled multi-target R&D smoke test; transform only the requested hairstyle while preserving subject identity and the original photograph."
    ),
  })));

  const result = await prisma.$transaction(async (tx) => {
    const campaign = await tx.rnDCampaign.create({
      data: {
        name: "R&D MULTI-TARGET LIFECYCLE SMOKE",
        status: "RUNNING",
        autoAdvanceEnabled: true,
        createdByUserId: admin.id,
      },
    });

    const source = await tx.rnDAsset.upsert({
      where: { storageKey },
      create: {
        kind: "SOURCE",
        storageKey,
        blobUrl: blob?.url ?? "",
        originalFilename: "multi-target-smoke-source.webp",
        mimeType,
        fileSize: buffer.length,
        checksum,
        immutable: true,
      },
      update: {},
    });

    const targets = [];
    for (let index = 0; index < built.length; index += 1) {
      const item = built[index];
      const target = await tx.rnDTarget.create({
        data: {
          campaignId: campaign.id,
          targetType: "SINGLE",
          targetKey: "smoke-" + item.style.promptKey + "-" + Date.now() + "-" + index,
          hairstyleId: item.style.id,
          hardCoreInstruction: "Controlled multi-target lifecycle smoke test.",
          sourceAssetId: source.id,
          status: "QUEUED",
        },
      });
      const job = await tx.rnDJob.create({
        data: {
          targetId: target.id,
          status: "QUEUED",
          promptVersionNumber: 1,
          currentPrompt: item.prompt.prompt,
          queuedAt: new Date(),
        },
      });
      targets.push({ targetId: target.id, jobId: job.id, style: item.style.promptKey });
    }

    return { campaignId: campaign.id, sourceAssetId: source.id, targets };
  });

  return json({
    ok: true,
    mode: "QUEUE_ONLY",
    message: "Three real R&D jobs queued for the local Gemini worker.",
    ...result,
  });
}
