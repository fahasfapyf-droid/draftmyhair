import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { requireRndWorker } from "@/lib/rnd/worker-auth";
import { buildRndPrompt } from "@/lib/rnd/prompt";
import { STYLE_PROMPTS } from "@/lib/engine/prompts/styles";

export const runtime = "nodejs";

const MAX_SOURCE_BYTES = 15 * 1024 * 1024;
const ALLOWED_SOURCE_HOSTS = new Set(["www.draftmyhair.com", "draftmyhair.com"]);

export async function POST(request: Request) {
  const auth = requireRndWorker(request.headers.get("authorization"));
  if (auth) return auth;

  const body = (await request.json().catch(() => null)) as { sourceUrl?: unknown; promptKey?: unknown; targetKey?: unknown } | null;
  const sourceUrl = typeof body?.sourceUrl === "string" ? body.sourceUrl.trim() : "";
  const promptKey = typeof body?.promptKey === "string" ? body.promptKey.trim() : "";
  const targetKey = typeof body?.targetKey === "string" ? body.targetKey.trim() : "";

  if (!sourceUrl || !promptKey || !targetKey) {
    return NextResponse.json({ error: "sourceUrl, promptKey and targetKey are required" }, { status: 400 });
  }

  let parsed: URL;
  try { parsed = new URL(sourceUrl); } catch { return NextResponse.json({ error: "sourceUrl must be a valid URL" }, { status: 400 }); }
  if (parsed.protocol !== "https:" || !ALLOWED_SOURCE_HOSTS.has(parsed.hostname)) {
    return NextResponse.json({ error: "Test source URL is not allowed" }, { status: 400 });
  }

  const compiledStyle = STYLE_PROMPTS[promptKey];
  if (!compiledStyle) return NextResponse.json({ error: "Unknown hairstyle prompt key" }, { status: 404 });

  // R&D test enqueue must not depend on the production Preview hairstyle catalog being seeded.
  // Reuse an existing hairstyle row when present; otherwise create a minimal R&D catalog row.
  const existingHairstyle = await prisma.hairstyle.findUnique({ where: { promptKey }, select: { id: true } });
  const hairstyle = existingHairstyle ?? await prisma.hairstyle.create({
    data: {
      name: promptKey.replace(/[-_]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()),
      slug: promptKey,
      serviceType: "HAIRSTYLE",
      category: null,
      gender: "UNISEX",
      description: "R&D test hairstyle catalog entry.",
      promptKey,
      isActive: true,
      displayOrder: 9000,
    },
    select: { id: true },
  });

  const response = await fetch(parsed.toString(), { cache: "no-store", signal: AbortSignal.timeout(30_000) });
  if (!response.ok) return NextResponse.json({ error: "Test source image could not be fetched" }, { status: 502 });
  const mimeType = response.headers.get("content-type")?.split(";")[0]?.trim() || "image/webp";
  if (!mimeType.startsWith("image/")) return NextResponse.json({ error: "Test source is not an image" }, { status: 415 });

  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.length || buffer.length > MAX_SOURCE_BYTES) return NextResponse.json({ error: "Test source image size is outside the allowed range" }, { status: 413 });

  const checksum = createHash("sha256").update(buffer).digest("hex");
  const extension = mimeType === "image/jpeg" ? "jpg" : mimeType === "image/png" ? "png" : "webp";
  const storageKey = "rnd/sources/" + checksum + "." + extension;
  const existingSource = await prisma.rnDAsset.findUnique({ where: { storageKey }, select: { id: true, blobUrl: true, mimeType: true, fileSize: true, checksum: true } });
  const blob = existingSource ? null : await put(storageKey, buffer, { access: "private", addRandomSuffix: false, contentType: mimeType });
  const built = await buildRndPrompt({ promptKey });
  const workerId = request.headers.get("x-rnd-worker-id")?.trim() || "rnd-worker";

  const result = await prisma.$transaction(async (tx) => {
    const campaign = await tx.rnDCampaign.create({
      data: { name: "R&D automated test", status: "RUNNING", autoAdvanceEnabled: true, createdByUserId: workerId },
    });
    const source = await tx.rnDAsset.upsert({
      where: { storageKey },
      create: {
        kind: "SOURCE",
        storageKey,
        blobUrl: blob!.url,
        originalFilename: parsed.pathname.split("/").pop() || "test-source",
        mimeType,
        fileSize: buffer.length,
        checksum,
        immutable: true,
      },
      update: {},
    });
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
      data: { targetId: target.id, status: "QUEUED", promptVersionNumber: 1, currentPrompt: built.prompt, queuedAt: new Date() },
    });
    return { campaign, target, source, job };
  });

  return NextResponse.json({
    ok: true,
    campaignId: result.campaign.id,
    targetId: result.target.id,
    sourceAssetId: result.source.id,
    jobId: result.job.id,
  });
}
