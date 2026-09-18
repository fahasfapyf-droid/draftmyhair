import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { requireRndProducer } from "@/lib/rnd/producer-auth";
import { buildRndPrompt } from "@/lib/rnd/prompt";

export const runtime = "nodejs";
const MAX_SOURCE_BYTES = 15 * 1024 * 1024;

export async function POST(request: Request) {
  const auth = requireRndProducer(request);
  if (auth) return auth;

  const form = await request.formData().catch(() => null);
  const image = form?.get("image");
  const name = typeof form?.get("campaignName") === "string" ? String(form!.get("campaignName")).trim() : "";
  const targetKey = typeof form?.get("targetKey") === "string" ? String(form!.get("targetKey")).trim() : "";
  const promptKey = typeof form?.get("promptKey") === "string" ? String(form!.get("promptKey")).trim() : "";
  const hardCoreInstruction = typeof form?.get("hardCoreInstruction") === "string" ? String(form!.get("hardCoreInstruction")).trim() : "";

  if (!(image instanceof File) || !image.type.startsWith("image/")) return NextResponse.json({ error: "image must be an image file" }, { status: 400 });
  if (image.size <= 0 || image.size > MAX_SOURCE_BYTES) return NextResponse.json({ error: "source image size is outside the allowed range" }, { status: 413 });
  if (!name || !targetKey || !promptKey) return NextResponse.json({ error: "campaignName, targetKey and promptKey are required" }, { status: 400 });

  const hairstyle = await prisma.hairstyle.findFirst({ where: { promptKey, isActive: true }, select: { id: true } });
  if (!hairstyle) return NextResponse.json({ error: "Active hairstyle prompt key not found" }, { status: 404 });

  const buffer = Buffer.from(await image.arrayBuffer());
  const checksum = createHash("sha256").update(buffer).digest("hex");
  const extension = image.type === "image/jpeg" ? "jpg" : image.type === "image/webp" ? "webp" : "png";
  const storageKey = "rnd/sources/" + checksum + "." + extension;
  const existingSource = await prisma.rnDAsset.findUnique({ where: { storageKey }, select: { id: true } });
  const blob = existingSource ? null : await put(storageKey, buffer, { access: "private", addRandomSuffix: false, contentType: image.type });
  const built = await buildRndPrompt({ promptKey });
  const createdByUserId = process.env.RND_PRODUCER_USER_ID?.trim();
  if (!createdByUserId) return NextResponse.json({ error: "R&D producer identity is not configured." }, { status: 503 });

  const result = await prisma.$transaction(async (tx) => {
    const campaign = await tx.rnDCampaign.create({ data: { name, status: "RUNNING", autoAdvanceEnabled: true, createdByUserId } });
    const source = await tx.rnDAsset.upsert({
      where: { storageKey },
      create: { kind: "SOURCE", storageKey, blobUrl: blob!.url, originalFilename: image.name || null, mimeType: image.type, fileSize: image.size, checksum, immutable: true },
      update: {},
    });
    const target = await tx.rnDTarget.create({
      data: { campaignId: campaign.id, targetType: "SINGLE", targetKey, hairstyleId: hairstyle.id, hardCoreInstruction: hardCoreInstruction || null, sourceAssetId: source.id, status: "QUEUED" },
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
    promptDiagnostics: built.diagnostics,
  });
}
